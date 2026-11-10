"""Notification generation (database level) and the REST API. Runs on the in-memory test database."""

from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.models import Notification
from app.services import notification_rules, notification_service
from notification_helpers import add_notification, notifications_of, order_payload

LIST = "/api/notifications"
COUNT = "/api/notifications/unread-count"


@pytest.fixture()
def settings(monkeypatch):
    """The live settings object; tests change its thresholds with monkeypatch (restored after each test)."""
    return get_settings()


def titles(user_rows):
    return [n.title for n in user_rows]


# --- generation ---------------------------------------------------------------------------------


def test_high_value_order_notifies_admin_and_analyst_but_not_viewer(client, users, db_session, settings, monkeypatch):
    monkeypatch.setattr(settings, "high_value_order_threshold", Decimal("1"))

    response = client.post("/api/orders", json=order_payload(db_session))
    assert response.status_code == 201

    for role in ("admin", "analyst"):
        rows = notifications_of(db_session, users[role])
        assert titles(rows) == ["High-Value Order Received"]
        assert rows[0].priority == "high" and rows[0].type == "order"
        assert rows[0].related_entity_id == response.json()["id"]
        assert "₹" in rows[0].message
    assert notifications_of(db_session, users["viewer"]) == []
    assert notifications_of(db_session, users["disabled"]) == []  # disabled accounts receive nothing


def test_order_below_the_threshold_creates_no_alert(client, users, db_session, settings, monkeypatch):
    monkeypatch.setattr(settings, "high_value_order_threshold", Decimal("1000000000"))
    assert client.post("/api/orders", json=order_payload(db_session)).status_code == 201
    assert db_session.scalars(select(Notification)).all() == []


def test_completing_and_cancelling_orders_creates_status_alerts(client, users, db_session, settings, monkeypatch):
    monkeypatch.setattr(settings, "high_value_order_threshold", Decimal("1000000000"))
    first = client.post("/api/orders", json=order_payload(db_session)).json()["id"]
    second = client.post("/api/orders", json=order_payload(db_session)).json()["id"]

    assert client.patch(f"/api/orders/{first}/status", json={"status": "completed"}).status_code == 200
    assert client.patch(f"/api/orders/{second}/status", json={"status": "cancelled"}).status_code == 200

    assert sorted(titles(notifications_of(db_session, users["analyst"]))) == ["Order Cancelled", "Order Completed"]
    # An order that is no longer pending cannot change status again, so no second alert can appear.
    assert client.patch(f"/api/orders/{first}/status", json={"status": "completed"}).status_code == 409
    assert len(notifications_of(db_session, users["analyst"])) == 2


def test_revenue_and_low_sales_alerts_reach_every_role(client, users, db_session, settings, monkeypatch):
    monkeypatch.setattr(settings, "revenue_target", Decimal("1"))
    monkeypatch.setattr(settings, "low_sales_threshold", 1000000)

    response = client.post("/api/notifications/evaluate")
    assert response.status_code == 200
    assert response.json()["created"] > 0

    for role in ("admin", "analyst", "viewer"):
        types = {n.type for n in notifications_of(db_session, users[role])}
        assert types == {"revenue", "sales"}
    assert notifications_of(db_session, users["disabled"]) == []


def test_revenue_alert_for_a_known_period_uses_the_configured_target(db_session, users, settings, monkeypatch):
    monkeypatch.setattr(settings, "revenue_target", Decimal("999999999"))
    monkeypatch.setattr(settings, "low_sales_threshold", 1)
    created = notification_service.run_period_checks(db_session)
    revenue = [n for n in created if n.type == "revenue"]
    assert revenue and all(n.title == "Revenue Below Target" for n in revenue)


def test_the_same_event_never_notifies_twice(client, users, db_session, settings, monkeypatch):
    monkeypatch.setattr(settings, "revenue_target", Decimal("1"))
    first = client.post("/api/notifications/evaluate").json()["created"]
    second = client.post("/api/notifications/evaluate").json()["created"]
    assert first > 0
    assert second == 0

    draft = notification_rules.system_event("Deploy", "Deployed", "deploy:1")
    assert len(notification_service.dispatch(db_session, draft)) == 1  # one admin
    assert notification_service.dispatch(db_session, draft) == []  # same event again: skipped
    admin_rows = [n for n in notifications_of(db_session, users["admin"]) if n.dedupe_key == "system:deploy:1"]
    assert len(admin_rows) == 1


def test_a_failure_while_creating_alerts_never_breaks_the_business_action(
    client, db_session, settings, monkeypatch
):
    monkeypatch.setattr(settings, "high_value_order_threshold", Decimal("1"))

    def boom(*args, **kwargs):
        raise RuntimeError("alert storage is down")

    monkeypatch.setattr("app.repositories.notifications.insert_if_new", boom)
    response = client.post("/api/orders", json=order_payload(db_session))
    assert response.status_code == 201  # the order itself is still created


def test_system_alerts_go_to_admins_only(client, users, db_session):
    body = {"fullName": "New Person", "email": "new.person@test.com", "password": "Test-Pass-123", "role": "viewer"}
    assert client.post("/api/users", json=body).status_code == 201

    assert "User Created" in titles(notifications_of(db_session, users["admin"]))
    assert notifications_of(db_session, users["analyst"]) == []
    assert notifications_of(db_session, users["viewer"]) == []


def test_only_admins_can_run_the_alert_checks(client, users, auth_header):
    assert client.post("/api/notifications/evaluate", headers=auth_header(users["analyst"])).status_code == 403
    assert client.post("/api/notifications/evaluate", headers=auth_header(users["viewer"])).status_code == 403
    assert client.post("/api/notifications/evaluate", headers=auth_header(users["admin"])).status_code == 200


def test_viewers_cannot_create_orders(client, users, db_session, auth_header):
    response = client.post("/api/orders", json=order_payload(db_session), headers=auth_header(users["viewer"]))
    assert response.status_code == 403


# --- retrieval ----------------------------------------------------------------------------------


def test_requests_without_a_token_are_rejected(anon_client):
    assert anon_client.get(LIST).status_code == 401
    assert anon_client.get(COUNT).status_code == 401
    assert anon_client.patch("/api/notifications/read-all").status_code == 401


def test_a_user_sees_only_their_own_notifications(client, users, db_session, auth_header):
    add_notification(db_session, users["admin"], "Admin one")
    add_notification(db_session, users["admin"], "Admin two")
    add_notification(db_session, users["analyst"], "Analyst one")

    body = client.get(LIST, headers=auth_header(users["analyst"])).json()
    assert body["total"] == 1
    assert [item["title"] for item in body["items"]] == ["Analyst one"]
    item = body["items"][0]
    assert set(item) >= {"id", "title", "message", "type", "priority", "isRead", "createdAt", "readAt"}
    assert item["isRead"] is False and item["readAt"] is None


def test_filters_by_type_priority_and_read_state(client, users, db_session, auth_header):
    admin = users["admin"]
    add_notification(db_session, admin, "A", type="revenue", priority="critical", minutes=1)
    add_notification(db_session, admin, "B", type="order", priority="high", minutes=2)
    add_notification(db_session, admin, "C", type="order", priority="low", is_read=True, minutes=3)
    headers = auth_header(admin)

    def names(**params):
        return [i["title"] for i in client.get(LIST, params=params, headers=headers).json()["items"]]

    assert names(type="order") == ["C", "B"]
    assert names(priority="critical") == ["A"]
    assert names(is_read="false") == ["B", "A"]
    assert names(is_read="true") == ["C"]
    assert names(type="order", is_read="false") == ["B"]
    assert client.get(LIST, params={"type": "bogus"}, headers=headers).status_code == 422
    assert client.get(LIST, params={"priority": "urgent"}, headers=headers).status_code == 422


def test_sorting_and_pagination(client, users, db_session, auth_header):
    admin = users["admin"]
    for minute, name in enumerate(["first", "second", "third"]):
        add_notification(db_session, admin, name, minutes=minute)
    headers = auth_header(admin)

    newest = client.get(LIST, params={"sort": "newest"}, headers=headers).json()
    oldest = client.get(LIST, params={"sort": "oldest"}, headers=headers).json()
    assert [i["title"] for i in newest["items"]] == ["third", "second", "first"]
    assert [i["title"] for i in oldest["items"]] == ["first", "second", "third"]

    page = client.get(LIST, params={"limit": 2, "offset": 2}, headers=headers).json()
    assert page["total"] == 3 and page["limit"] == 2 and page["offset"] == 2
    assert [i["title"] for i in page["items"]] == ["first"]
    assert client.get(LIST, params={"limit": 0}, headers=headers).status_code == 422
    assert client.get(LIST, params={"sort": "random"}, headers=headers).status_code == 422


# --- read state and unread counts ---------------------------------------------------------------


def test_unread_count_tracks_each_user_separately(client, users, db_session, auth_header):
    add_notification(db_session, users["admin"], "1")
    add_notification(db_session, users["admin"], "2")
    add_notification(db_session, users["admin"], "3", is_read=True)
    add_notification(db_session, users["analyst"], "4")

    assert client.get(COUNT, headers=auth_header(users["admin"])).json() == {"unreadCount": 2}
    assert client.get(COUNT, headers=auth_header(users["analyst"])).json() == {"unreadCount": 1}
    assert client.get(COUNT, headers=auth_header(users["viewer"])).json() == {"unreadCount": 0}


def test_marking_one_notification_read_updates_the_count(client, users, db_session, auth_header):
    first = add_notification(db_session, users["admin"], "1")
    add_notification(db_session, users["admin"], "2")
    headers = auth_header(users["admin"])

    response = client.patch(f"{LIST}/{first.id}/read", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["isRead"] is True and body["readAt"] is not None
    assert client.get(COUNT, headers=headers).json() == {"unreadCount": 1}

    again = client.patch(f"{LIST}/{first.id}/read", headers=headers)  # idempotent
    assert again.status_code == 200 and again.json()["readAt"] == body["readAt"]
    assert client.get(COUNT, headers=headers).json() == {"unreadCount": 1}


def test_mark_all_read_only_touches_my_notifications(client, users, db_session, auth_header):
    add_notification(db_session, users["admin"], "a1")
    add_notification(db_session, users["admin"], "a2")
    other = add_notification(db_session, users["analyst"], "n1")

    response = client.patch(f"{LIST}/read-all", headers=auth_header(users["admin"]))
    assert response.json() == {"updated": 2, "unreadCount": 0}
    assert client.get(COUNT, headers=auth_header(users["admin"])).json() == {"unreadCount": 0}

    db_session.refresh(other)
    assert other.is_read is False  # the analyst's notification is untouched
    assert client.patch(f"{LIST}/read-all", headers=auth_header(users["admin"])).json()["updated"] == 0


def test_deleting_my_notification(client, users, db_session, auth_header):
    keep = add_notification(db_session, users["admin"], "keep")
    gone = add_notification(db_session, users["admin"], "gone")
    headers = auth_header(users["admin"])

    assert client.delete(f"{LIST}/{gone.id}", headers=headers).status_code == 204
    assert [i["title"] for i in client.get(LIST, headers=headers).json()["items"]] == ["keep"]
    assert client.delete(f"{LIST}/{gone.id}", headers=headers).status_code == 404
    assert keep.id != gone.id


# --- isolation: guessing ids must never work ----------------------------------------------------


def test_a_user_cannot_read_modify_or_delete_someone_elses_notification(client, users, db_session, auth_header):
    secret = add_notification(db_session, users["admin"], "Admin only")
    intruder = auth_header(users["analyst"])

    assert client.patch(f"{LIST}/{secret.id}/read", headers=intruder).status_code == 404
    assert client.delete(f"{LIST}/{secret.id}", headers=intruder).status_code == 404
    assert client.get(LIST, headers=intruder).json()["items"] == []

    db_session.refresh(secret)
    assert secret.is_read is False  # not modified
    assert db_session.get(Notification, secret.id) is not None  # not deleted

    # The 404 for another user's id is identical to the 404 for an id that does not exist.
    missing = client.patch(f"{LIST}/999999/read", headers=intruder)
    assert missing.status_code == 404
    assert missing.json() == client.patch(f"{LIST}/{secret.id}/read", headers=intruder).json()


def test_the_owner_is_always_the_token_not_a_parameter(client, users, db_session, auth_header):
    add_notification(db_session, users["admin"], "Admin only")
    response = client.get(
        LIST,
        params={"user_id": users["admin"].id, "userId": users["admin"].id},
        headers=auth_header(users["analyst"]),
    )
    assert response.json()["items"] == []