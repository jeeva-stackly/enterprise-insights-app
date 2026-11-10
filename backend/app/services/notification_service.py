"""Creates notifications for business events and hands them to the live-delivery hook.

Flow: event -> rule (notification_rules) -> recipients (by permission, from the database)
      -> INSERT one row per recipient (duplicates skipped) -> COMMIT -> publish to connected users.

Delivery is best effort: a failure while creating or publishing alerts is logged and never breaks
the business action (for example, placing an order) that triggered it. PostgreSQL stays the source of
truth, so a user who missed a live message still sees it in GET /api/notifications.
"""

import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import roles_with
from app.models import Notification, Order
from app.repositories import analytics as analytics_repo
from app.repositories import notifications as notifications_repo
from app.repositories import users as users_repo
from app.schemas.common import Page
from app.schemas.notification import MarkAllReadOut, NotificationOut, UnreadCountOut
from app.services import notification_publisher, notification_rules
from app.services.errors import NotFoundError
from app.services.notification_rules import NotificationDraft
from app.utils.dates import range_bounds, utc_today

logger = logging.getLogger(__name__)


def to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        title=n.title,
        message=n.message,
        type=n.type,  # type: ignore[arg-type]
        priority=n.priority,  # type: ignore[arg-type]
        related_entity_type=n.related_entity_type,
        related_entity_id=n.related_entity_id,
        is_read=n.is_read,
        created_at=n.created_at,
        read_at=n.read_at,
    )


def dispatch(db: Session, draft: NotificationDraft | None) -> list[NotificationOut]:
    """Store `draft` for every active user whose role may see it, then publish live. Never raises."""
    if draft is None:
        return []
    try:
        recipients = users_repo.list_active_by_roles(db, roles_with(draft.audience))
        created: list[tuple[int, Notification]] = []
        for user in recipients:
            row = notifications_repo.insert_if_new(
                db,
                user_id=user.id,
                title=draft.title,
                message=draft.message,
                type=draft.type,
                priority=draft.priority,
                related_entity_type=draft.related_entity_type,
                related_entity_id=draft.related_entity_id,
                dedupe_key=draft.dedupe_key,
            )
            if row is not None:
                created.append((user.id, row))
        db.commit()
        results = [(user_id, to_out(row)) for user_id, row in created]
    except Exception:
        db.rollback()
        logger.exception("Could not create notification %r", draft.dedupe_key)
        return []

    for user_id, out in results:
        try:
            notification_publisher.publish(user_id, out)
        except Exception:  # a broken socket must never break the business action
            logger.exception("Could not publish notification %s to user %s", out.id, user_id)
    return [out for _, out in results]


# --- business events -------------------------------------------------------------------------


def on_order_created(db: Session, order: Order) -> None:
    settings = get_settings()
    dispatch(
        db,
        notification_rules.high_value_order(
            order.id, order.order_number, order.total_amount, settings.high_value_order_threshold
        ),
    )


def on_order_status_changed(db: Session, order: Order) -> None:
    dispatch(db, notification_rules.order_status_changed(order.id, order.order_number, order.status, order.total_amount))


def reporting_period(today: date | None = None) -> tuple[date, date]:
    """The last `alert_period_days` COMPLETE days, ending yesterday (today is still in progress)."""
    end = (today or utc_today()) - timedelta(days=1)
    start = end - timedelta(days=get_settings().alert_period_days - 1)
    return start, end


def run_period_checks(db: Session, today: date | None = None) -> list[NotificationOut]:
    """Evaluate the revenue target and the low-sales threshold for the latest reporting period.

    Safe to run as often as you like (cron, a button, a script): each period alerts only once per user.
    """
    settings = get_settings()
    start, end = reporting_period(today)
    stats = analytics_repo.period_stats(db, *range_bounds(start, end))
    created = dispatch(db, notification_rules.revenue_performance(stats.revenue, settings.revenue_target, start, end))
    created += dispatch(db, notification_rules.low_sales(stats.completed, settings.low_sales_threshold, start, end))
    return created


def notify_system(db: Session, title: str, message: str, event_key: str, priority: str = "medium") -> None:
    dispatch(db, notification_rules.system_event(title, message, event_key, priority))

# --- what the REST API uses: every function takes the AUTHENTICATED user's id ---------------------


def list_for_user(
    db: Session,
    user_id: int,
    limit: int,
    offset: int,
    type: str | None,
    priority: str | None,
    is_read: bool | None,
    sort: str,
) -> Page[NotificationOut]:
    rows, total = notifications_repo.list_for_user(
        db, user_id, limit, offset, type, priority, is_read, newest_first=(sort != "oldest")
    )
    return Page[NotificationOut](items=[to_out(n) for n in rows], total=total, limit=limit, offset=offset)


def unread_count(db: Session, user_id: int) -> UnreadCountOut:
    return UnreadCountOut(unread_count=notifications_repo.unread_count(db, user_id))


def _get_owned_or_404(db: Session, user_id: int, notification_id: int) -> Notification:
    # Someone else's notification gets the SAME 404 as a missing one, so ids cannot be probed.
    notification = notifications_repo.get_owned(db, user_id, notification_id)
    if notification is None:
        raise NotFoundError("Notification not found.")
    return notification


def mark_read(db: Session, user_id: int, notification_id: int) -> NotificationOut:
    notification = _get_owned_or_404(db, user_id, notification_id)
    notifications_repo.mark_read(db, notification)
    db.commit()
    return to_out(notification)


def mark_all_read(db: Session, user_id: int) -> MarkAllReadOut:
    updated = notifications_repo.mark_all_read(db, user_id)
    db.commit()
    return MarkAllReadOut(updated=updated, unread_count=notifications_repo.unread_count(db, user_id))


def delete(db: Session, user_id: int, notification_id: int) -> None:
    notification = _get_owned_or_404(db, user_id, notification_id)
    notifications_repo.delete(db, notification)
    db.commit()