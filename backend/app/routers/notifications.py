from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.db.session import get_db
from app.models import User
from app.routers.deps import Limit, Offset
from app.schemas.common import Page
from app.schemas.notification import (
    EvaluateOut,
    MarkAllReadOut,
    NotificationOut,
    NotificationPriority,
    NotificationType,
    UnreadCountOut,
)
from app.services import notification_service

# Every route below works on the AUTHENTICATED user's notifications only. The user id always comes
# from the token (get_current_user), never from the URL or the body, so there is nothing to tamper with.
router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=Page[NotificationOut],
    summary="My notifications (paginated, filterable, sortable)",
)
def list_notifications(
    limit: Limit = 20,
    offset: Offset = 0,
    type: NotificationType | None = Query(default=None, description="Filter by category."),
    priority: NotificationPriority | None = Query(default=None, description="Filter by priority."),
    is_read: bool | None = Query(default=None, description="true = read only, false = unread only."),
    sort: Literal["newest", "oldest"] = Query(default="newest", description="Sort by creation date."),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[NotificationOut]:
    return notification_service.list_for_user(db, user.id, limit, offset, type, priority, is_read, sort)


@router.get("/unread-count", response_model=UnreadCountOut, summary="Number of my unread notifications")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UnreadCountOut:
    return notification_service.unread_count(db, user.id)


@router.patch("/read-all", response_model=MarkAllReadOut, summary="Mark all my notifications as read")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MarkAllReadOut:
    return notification_service.mark_all_read(db, user.id)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationOut,
    summary="Mark one of my notifications as read",
    description="404 when the notification does not exist OR belongs to another user (the two are indistinguishable).",
)
def mark_read(
    notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> NotificationOut:
    return notification_service.mark_read(db, user.id, notification_id)


@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one of my notifications",
    description="Users can delete only their own notifications; anything else is a 404.",
)
def delete_notification(
    notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    notification_service.delete(db, user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/evaluate",
    response_model=EvaluateOut,
    summary="Run the revenue-target and low-sales checks now (admin)",
    description="Same as the scheduled check. Alerts for a period that were already created are not repeated.",
    dependencies=[Depends(require_permission(Permission.RUN_ALERT_CHECKS))],
)
def evaluate(db: Session = Depends(get_db)) -> EvaluateOut:
    return EvaluateOut(created=len(notification_service.run_period_checks(db)))