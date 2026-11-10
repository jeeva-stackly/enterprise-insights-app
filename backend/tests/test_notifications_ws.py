"""WebSocket tests: authentication, delivery to the right user, dead clients and disconnects."""

import asyncio
import time
from contextlib import contextmanager, nullcontext
from datetime import timedelta
from decimal import Decimal

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings
from app.core.security import create_access_token
from app.main import app
from app.realtime.connection_manager import ConnectionManager, manager
from app.routers.ws import CLOSE_TOO_MANY, CLOSE_UNAUTHORIZED, get_session_factory
from notification_helpers import add_notification, order_payload

URL = "/ws/notifications"


@pytest.fixture(autouse=True)
def clean_manager():
    manager.reset()
    yield
    manager.reset()


@pytest.fixture()
def api(client, db_session, monkeypatch):
    """The admin-authenticated client, with the socket endpoint using the test database and every order alerting."""
    app.dependency_overrides[get_session_factory] = lambda: (lambda: nullcontext(db_session))
    monkeypatch.setattr(get_settings(), "high_value_order_threshold", Decimal("1"))
    return client


def token_for(user):
    return create_access_token(user.id)[0]


@contextmanager
def authed_socket(client, user):
    with client.websocket_connect(URL) as ws:
        ws.send_json({"type": "auth", "token": token_for(user)})
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        yield ws, ready


def wait_until(condition, timeout=3.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if condition():
            return True
        time.sleep(0.02)
    return condition()


def expect_close(ws, code):
    with pytest.raises(WebSocketDisconnect) as closed:
        ws.receive_json()
    assert closed.value.code == code


# --- authentication -----------------------------------------------------------------------------


def test_valid_token_gets_ready_with_the_current_unread_count(api, users, db_session):
    add_notification(db_session, users["analyst"], "one")
    add_notification(db_session, users["analyst"], "two")
    with authed_socket(api, users["analyst"]) as (_, ready):
        assert ready == {"type": "ready", "unreadCount": 2}
        assert manager.connection_count(users["analyst"].id) == 1


def test_a_bad_token_is_rejected(api):
    with api.websocket_connect(URL) as ws:
        ws.send_json({"type": "auth", "token": "not-a-real-token"})
        expect_close(ws, CLOSE_UNAUTHORIZED)
    assert manager.connection_count() == 0


def test_an_expired_token_is_rejected(api, users):
    expired, _ = create_access_token(users["admin"].id, timedelta(seconds=-30))
    with api.websocket_connect(URL) as ws:
        ws.send_json({"type": "auth", "token": expired})
        expect_close(ws, CLOSE_UNAUTHORIZED)


def test_a_disabled_user_is_rejected(api, users):
    with api.websocket_connect(URL) as ws:
        ws.send_json({"type": "auth", "token": token_for(users["disabled"])})
        expect_close(ws, CLOSE_UNAUTHORIZED)


def test_the_first_message_must_be_auth(api, users):
    with api.websocket_connect(URL) as ws:
        ws.send_json({"type": "ping"})
        expect_close(ws, CLOSE_UNAUTHORIZED)
    with api.websocket_connect(URL) as ws:
        ws.send_text("this is not json")
        expect_close(ws, CLOSE_UNAUTHORIZED)


def test_nothing_is_sent_before_authentication(api, users, db_session):
    add_notification(db_session, users["admin"], "secret")
    with api.websocket_connect(URL) as ws:
        ws.send_json({"type": "auth", "token": "bad"})
        expect_close(ws, CLOSE_UNAUTHORIZED)  # the only thing a failed client ever receives is the close


# --- delivery -----------------------------------------------------------------------------------


def test_a_new_notification_reaches_the_right_users_only(api, users, db_session):
    with authed_socket(api, users["analyst"]) as (analyst_ws, _), authed_socket(api, users["viewer"]) as (viewer_ws, _):
        response = api.post("/api/orders", json=order_payload(db_session))
        assert response.status_code == 201

        message = analyst_ws.receive_json()
        assert message["type"] == "notification"
        data = message["data"]
        assert data["title"] == "High-Value Order Received"
        assert data["priority"] == "high" and data["isRead"] is False
        assert data["relatedEntityId"] == response.json()["id"]

        # The viewer is not a recipient of order alerts: the next thing it sees is the pong, not an alert.
        viewer_ws.send_json({"type": "ping"})
        assert viewer_ws.receive_json() == {"type": "pong"}


def test_all_connections_of_one_user_receive_it(api, users, db_session):
    with authed_socket(api, users["analyst"]) as (phone, _), authed_socket(api, users["analyst"]) as (tablet, _):
        assert manager.connection_count(users["analyst"].id) == 2
        api.post("/api/orders", json=order_payload(db_session))
        assert phone.receive_json()["type"] == "notification"
        assert tablet.receive_json()["type"] == "notification"


def test_the_pushed_notification_matches_the_stored_one(api, users, db_session, auth_header):
    with authed_socket(api, users["analyst"]) as (ws, _):
        api.post("/api/orders", json=order_payload(db_session))
        pushed = ws.receive_json()["data"]
    stored = api.get("/api/notifications", headers=auth_header(users["analyst"])).json()["items"]
    assert [item["id"] for item in stored] == [pushed["id"]]
    for field in ("title", "message", "type", "priority", "isRead", "relatedEntityId"):
        assert stored[0][field] == pushed[field]


def test_a_user_who_is_offline_still_gets_it_from_the_database(api, users, db_session, auth_header):
    """Nobody is connected: publishing is a harmless no-op and the alert is waiting in PostgreSQL."""
    assert manager.connection_count() == 0
    assert api.post("/api/orders", json=order_payload(db_session)).status_code == 201
    stored = api.get("/api/notifications", headers=auth_header(users["analyst"])).json()
    assert stored["total"] == 1 and stored["items"][0]["title"] == "High-Value Order Received"


def test_keep_alive_ping_gets_a_pong(api, users):
    with authed_socket(api, users["admin"]) as (ws, _):
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}
        ws.send_text("garbage that is ignored")
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


# --- disconnects --------------------------------------------------------------------------------


def test_closing_the_socket_removes_the_connection(api, users):
    """What the mobile app does on logout: close the socket. The server must forget it."""
    with authed_socket(api, users["analyst"]) as (_, _):
        assert manager.connection_count(users["analyst"].id) == 1
    assert wait_until(lambda: manager.connection_count(users["analyst"].id) == 0)


def test_closing_one_connection_keeps_the_other_alive(api, users, db_session):
    with authed_socket(api, users["analyst"]) as (stays, _):
        with authed_socket(api, users["analyst"]) as (_, _):
            assert manager.connection_count(users["analyst"].id) == 2
        assert wait_until(lambda: manager.connection_count(users["analyst"].id) == 1)
        api.post("/api/orders", json=order_payload(db_session))
        assert stays.receive_json()["type"] == "notification"


def test_creating_an_order_after_the_client_disconnected_still_works(api, users, db_session):
    with authed_socket(api, users["analyst"]) as (_, _):
        pass
    assert wait_until(lambda: manager.connection_count() == 0)
    assert api.post("/api/orders", json=order_payload(db_session)).status_code == 201


def test_a_dead_socket_is_dropped_without_affecting_the_healthy_one():
    class Healthy:
        def __init__(self):
            self.sent = []

        async def send_json(self, payload):
            self.sent.append(payload)

    class Dead:
        async def send_json(self, payload):
            raise RuntimeError("connection lost")

    local = ConnectionManager()
    healthy, dead = Healthy(), Dead()

    async def scenario():
        assert local.connect(1, healthy) and local.connect(1, dead)
        await local.send_to_user(1, {"type": "notification"})

    asyncio.run(scenario())
    assert healthy.sent == [{"type": "notification"}]
    assert local.connection_count(1) == 1  # only the healthy socket is left


def test_a_user_cannot_open_unlimited_connections(api, users, monkeypatch):
    monkeypatch.setattr(manager, "max_per_user", 1)
    with authed_socket(api, users["analyst"]) as (_, _):
        with api.websocket_connect(URL) as second:
            second.send_json({"type": "auth", "token": token_for(users["analyst"])})
            expect_close(second, CLOSE_TOO_MANY)
        assert manager.connection_count(users["analyst"].id) == 1