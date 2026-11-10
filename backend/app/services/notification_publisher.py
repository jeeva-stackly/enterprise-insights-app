"""Hook between the notification service and whatever delivers notifications live.

The service must not import the WebSocket layer (that would couple business logic to transport).
Instead it calls `publish`, and the realtime layer registers itself with `set_publisher` at startup.
With no publisher registered (tests, scripts, a future push-notification sender) it does nothing.
"""

from collections.abc import Callable

from app.schemas.notification import NotificationOut

Publisher = Callable[[int, NotificationOut], None]

_publisher: Publisher | None = None


def set_publisher(publisher: Publisher | None) -> None:
    global _publisher
    _publisher = publisher


def publish(user_id: int, notification: NotificationOut) -> None:
    if _publisher is not None:
        _publisher(user_id, notification)