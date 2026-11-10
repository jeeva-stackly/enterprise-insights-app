"""Keeps track of which WebSocket connections belong to which user and pushes messages to them.

IN-MEMORY, SINGLE PROCESS (acceptable for this task, see README "Scaling"):
  * The connection table lives in this process. With several backend instances (or several uvicorn
    workers) a notification created on instance A cannot reach a user connected to instance B.
    The fix later is a shared channel (Redis pub/sub or PostgreSQL LISTEN/NOTIFY) that every
    instance subscribes to and forwards to its own local connections.
  * A restart drops every connection; clients reconnect and reload from PostgreSQL, which is the
    source of truth, so nothing is lost.

Threading: services and routes are plain `def` functions that FastAPI runs in a worker thread, while
sockets live on the event loop. `publish` is therefore thread-safe: it hands the real work to the
loop with run_coroutine_threadsafe.
"""

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from app.schemas.notification import NotificationOut

logger = logging.getLogger(__name__)

MAX_CONNECTIONS_PER_USER = 5  # one user on several devices/tabs is fine; unlimited is a resource leak


class ConnectionManager:
    def __init__(self, max_per_user: int = MAX_CONNECTIONS_PER_USER) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self.max_per_user = max_per_user

    # -- event-loop side ----------------------------------------------------------------------

    def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Register an ALREADY ACCEPTED and AUTHENTICATED socket. False when the user has too many."""
        self._loop = asyncio.get_running_loop()
        sockets = self._connections.setdefault(user_id, set())
        if len(sockets) >= self.max_per_user:
            return False
        sockets.add(websocket)
        return True

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            del self._connections[user_id]

    def connection_count(self, user_id: int | None = None) -> int:
        if user_id is not None:
            return len(self._connections.get(user_id, ()))
        return sum(len(s) for s in self._connections.values())

    async def send_to_user(self, user_id: int, payload: dict[str, Any]) -> None:
        """Send to every connection of ONE user. A dead socket is dropped; it never affects the others."""
        for websocket in list(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                logger.info("Dropping a dead WebSocket for user %s", user_id)
                self.disconnect(user_id, websocket)

    # -- any thread ---------------------------------------------------------------------------

    def publish(self, user_id: int, notification: NotificationOut) -> None:
        """Called by notification_service after the notification is committed. Never raises."""
        loop = self._loop
        if loop is None or loop.is_closed() or user_id not in self._connections:
            return  # nobody online: the user will load it from the database later
        payload = {"type": "notification", "data": notification.model_dump(mode="json", by_alias=True)}
        try:
            asyncio.run_coroutine_threadsafe(self.send_to_user(user_id, payload), loop)
        except RuntimeError:  # loop shut down between the check and the call
            logger.info("Could not publish to user %s: event loop is closed", user_id)

    def reset(self) -> None:
        """Forget everything (used by tests between runs)."""
        self._connections.clear()
        self._loop = None


manager = ConnectionManager()