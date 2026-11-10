"""Shared helpers for the notification tests."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Customer, Notification, Product

BASE_TIME = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)


def add_notification(
    db,
    user,
    title="Test alert",
    type="order",
    priority="medium",
    is_read=False,
    minutes=0,
    dedupe_key=None,
):
    """Insert one notification straight into the (test) database. `minutes` controls created_at."""
    when = BASE_TIME + timedelta(minutes=minutes)
    notification = Notification(
        user_id=user.id,
        title=title,
        message=f"{title} message",
        type=type,
        priority=priority,
        is_read=is_read,
        created_at=when,
        read_at=when if is_read else None,
        dedupe_key=dedupe_key,
    )
    db.add(notification)
    db.commit()
    return notification


def notifications_of(db, user):
    return list(db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id)))


def order_payload(db, quantity=1):
    """A valid POST /api/orders body using an active customer and an active product from the seed data."""
    customer = db.scalar(select(Customer).where(Customer.status == "active").order_by(Customer.id))
    product = db.scalar(select(Product).where(Product.status == "active").order_by(Product.id))
    return {"customerId": customer.id, "productId": product.id, "quantity": quantity}