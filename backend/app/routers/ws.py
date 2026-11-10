"""WebSocket endpoint for live notifications.

Protocol (JSON text frames):
  client -> {"type": "auth", "token": "<JWT>"}      must be the FIRST message, within AUTH_TIMEOUT seconds
  server -> {"type": "ready", "unreadCount": 3}     authentication succeeded
  server -> {"type": "notification", "data": {...}} a new notification for THIS user only
  client -> {"type": "ping"}  /  server -> {"type": "pong"}   optional keep-alive

The token is sent in the first message, not in the URL, because URLs end up in server and proxy logs.
Close codes: 4401 = not authenticated (the client must log in again, do NOT retry with the same token),
4429 = too many connections for this user. Any other close = transient, the client may reconnect.
"""

import asyncio
import json
import logging
from collections.abc import Callable
from contextlib import AbstractContextManager

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.security import TokenError, decode_access_token
from app.db.session import SessionLocal
from app.realtime.connection_manager import manager
from app.repositories import notifications as notifications_repo
from app.repositories import users as users_repo

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Notifications"])

AUTH_TIMEOUT_SECONDS = 10
CLOSE_UNAUTHORIZED = 4401
CLOSE_TOO_MANY = 4429

SessionFactory = Callable[[], AbstractContextManager[Session]]


def get_session_factory() -> SessionFactory:
    """A factory (not a session) so the database connection is NOT held for the life of the socket."""
    return SessionLocal


def _authenticate(factory: SessionFactory, token: str) -> tuple[int, int] | None:
    """Returns (user_id, unread_count) for a valid token of an active user, else None. Runs in a thread."""
    try:
        user_id = decode_access_token(token)
    except TokenError:  # TokenExpiredError is a TokenError
        return None
    with factory() as db:
        user = users_repo.get_by_id(db, user_id)
        if user is None or not user.is_active:
            return None
        return user.id, notifications_repo.unread_count(db, user.id)


async def _read_auth_token(websocket: WebSocket) -> str | None:
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
        message = json.loads(raw)
    except (asyncio.TimeoutError, ValueError):
        return None
    if isinstance(message, dict) and message.get("type") == "auth" and isinstance(message.get("token"), str):
        return message["token"]
    return None


@router.websocket("/ws/notifications")
async def notifications_socket(
    websocket: WebSocket, session_factory: SessionFactory = Depends(get_session_factory)
) -> None:
    await websocket.accept()  # nothing is sent before authentication succeeds

    try:
        token = await _read_auth_token(websocket)
        identity = await run_in_threadpool(_authenticate, session_factory, token) if token else None
    except WebSocketDisconnect:
        return
    if identity is None:
        await websocket.close(code=CLOSE_UNAUTHORIZED, reason="Not authenticated")
        return

    user_id, unread = identity
    if not manager.connect(user_id, websocket):
        await websocket.close(code=CLOSE_TOO_MANY, reason="Too many connections")
        return

    try:
        await websocket.send_json({"type": "ready", "unreadCount": unread})
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except ValueError:
                continue  # ignore garbage instead of dropping the connection
            if isinstance(message, dict) and message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass  # normal: the client closed (for example on logout)
    except Exception:
        logger.exception("WebSocket for user %s failed", user_id)
    finally:
        manager.disconnect(user_id, websocket)