from datetime import datetime
from typing import Literal

from app.schemas.base import ApiModel

NotificationType = Literal["revenue", "sales", "order", "customer", "system"]
NotificationPriority = Literal["low", "medium", "high", "critical"]


class NotificationOut(ApiModel):
    """One alert as the client sees it. The recipient is always the authenticated user, so it is not repeated."""

    id: int
    title: str
    message: str
    type: NotificationType
    priority: NotificationPriority
    related_entity_type: str | None = None
    related_entity_id: int | None = None
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None


class UnreadCountOut(ApiModel):
    unread_count: int


class MarkAllReadOut(ApiModel):
    updated: int
    unread_count: int
    
class EvaluateOut(ApiModel):
    created: int