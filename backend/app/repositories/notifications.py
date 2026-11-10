"""Database access for notifications. EVERY query here is scoped by user_id, so a user can never
read, change or delete somebody else's notification by guessing an id."""

from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Notification
from app.utils.dates import utc_now


def insert_if_new(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    type: str,
    priority: str,
    related_entity_type: str | None,
    related_entity_id: int | None,
    dedupe_key: str | None,
) -> Notification | None:
    """Insert one notification unless this user already has one for the same business event.

    Returns the new row, or None when it was a duplicate. The cheap SELECT handles the normal case;
    the UNIQUE index (user_id, dedupe_key) is the real guarantee if two requests race.
    The caller commits.
    """
    if dedupe_key is not None:
        existing = db.scalar(
            select(Notification.id).where(Notification.user_id == user_id, Notification.dedupe_key == dedupe_key)
        )
        if existing is not None:
            return None

    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        priority=priority,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        dedupe_key=dedupe_key,
        is_read=False,
        created_at=utc_now(),
        read_at=None,
    )
    try:
        db.add(notification)
        db.flush()
    except IntegrityError:  # lost a race against an identical event
        db.rollback()
        return None
    return notification


def list_for_user(
    db: Session,
    user_id: int,
    limit: int,
    offset: int,
    type: str | None,
    priority: str | None,
    is_read: bool | None,
    newest_first: bool,
) -> tuple[list[Notification], int]:
    filters = [Notification.user_id == user_id]
    if type is not None:
        filters.append(Notification.type == type)
    if priority is not None:
        filters.append(Notification.priority == priority)
    if is_read is not None:
        filters.append(Notification.is_read.is_(is_read))

    order = (
        (Notification.created_at.desc(), Notification.id.desc())
        if newest_first
        else (Notification.created_at.asc(), Notification.id.asc())
    )
    page = select(Notification).where(*filters).order_by(*order).limit(limit).offset(offset)
    total = db.scalar(select(func.count()).select_from(Notification).where(*filters)) or 0
    return list(db.scalars(page).all()), total


def unread_count(db: Session, user_id: int) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id, Notification.is_read.is_(False)
    )
    return db.scalar(stmt) or 0


def get_owned(db: Session, user_id: int, notification_id: int) -> Notification | None:
    """The notification only if it belongs to `user_id`; someone else's id looks exactly like a missing one."""
    return db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id))


def mark_read(db: Session, notification: Notification, now: datetime | None = None) -> None:
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = now or utc_now()


def mark_all_read(db: Session, user_id: int, now: datetime | None = None) -> int:
    """Mark every unread notification of this user as read. Returns how many changed."""
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=now or utc_now())
    )
    return db.execute(stmt).rowcount or 0


def delete(db: Session, notification: Notification) -> None:
    db.delete(notification)