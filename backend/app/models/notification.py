from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.constants import NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES, in_list


class Notification(Base):
    """One alert for ONE user.

    A business event that concerns several people (for example a high-value order) produces one
    row per recipient. That keeps read/unread state, deletion and access control simple: every
    query is just "WHERE user_id = <the authenticated user>".
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))  # recipient
    title: Mapped[str] = mapped_column(String(150))
    message: Mapped[str] = mapped_column(String(500))
    type: Mapped[str] = mapped_column(String(20))  # revenue | sales | order | customer | system
    priority: Mapped[str] = mapped_column(String(20), default="medium", server_default="medium")
    # What the alert is about (e.g. type "order" + the order's id). Optional: system alerts have none.
    related_entity_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    related_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Identifies the business event ("order-high-value:42"). Together with user_id it is UNIQUE, so
    # the same event can never notify the same user twice, even if the rule runs again.
    dedupe_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(in_list("type", NOTIFICATION_TYPES), name="type_valid"),
        CheckConstraint(in_list("priority", NOTIFICATION_PRIORITIES), name="priority_valid"),
        # read_at is set exactly when the notification is read.
        CheckConstraint(
            "(is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL)",
            name="read_state_consistent",
        ),
        # Duplicate prevention (rows without a dedupe_key are not constrained).
        Index("uq_notifications_user_dedupe", "user_id", "dedupe_key", unique=True),
        # The list endpoint always filters by user; these cover its filters and sort order.
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
        Index("ix_notifications_user_type", "user_id", "type"),
        Index("ix_notifications_user_priority", "user_id", "priority"),
    )