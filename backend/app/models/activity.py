from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.constants import ACTIVITY_TYPES, in_list


class Activity(Base):
    """A business event for the "Recent activity" feed.

    `reference_type` + `reference_id` form a polymorphic pointer ("order" + 42, "customer" + 7).
    It is deliberately not a foreign key because it can point at different tables.
    """

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_type: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(255))
    reference_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        CheckConstraint(in_list("activity_type", ACTIVITY_TYPES), name="type_valid"),
        # A reference is either complete (type and id) or absent.
        CheckConstraint(
            "(reference_type IS NULL) = (reference_id IS NULL)",
            name="reference_complete",
        ),
    )