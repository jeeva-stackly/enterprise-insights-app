from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models import Activity, Order


def fetch_activities(db: Session, limit: int, offset: int = 0) -> list[tuple[Activity, Decimal | None]]:
    """Latest activities, newest first. For order-related events the order amount is joined
    in (LEFT JOIN, so activities without an order still appear)."""
    stmt = (
        select(Activity, Order.total_amount)
        .outerjoin(
            Order,
            and_(Activity.reference_type == "order", Activity.reference_id == Order.id),
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return [(activity, amount) for activity, amount in db.execute(stmt).all()]


def count_activities(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Activity)) or 0


def count_alerts_since(db: Session, since: datetime) -> int:
    stmt = (
        select(func.count())
        .select_from(Activity)
        .where(Activity.activity_type == "alert", Activity.created_at >= since)
    )
    return db.scalar(stmt) or 0