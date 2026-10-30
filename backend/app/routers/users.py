from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_permission
from app.core.permissions import Permission
from app.db.session import get_db
from app.routers.deps import Limit, Offset
from app.schemas.auth import UserOut
from app.schemas.common import Page
from app.schemas.user import RoleUpdate, StatusUpdate, UserCreate
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["Users (Admin)"])

# Account provisioning: there is no public sign-up. Admins create accounts here (or the first admin
# with `python -m scripts.create_user`), then share the initial password through a secure channel.


@router.get("", response_model=Page[UserOut], summary="List users (Admin)")
def read_users(
    limit: Limit = 20,
    offset: Offset = 0,
    _: object = Depends(require_permission(Permission.MANAGE_USERS)),
    db: Session = Depends(get_db),
) -> Page[UserOut]:
    return user_service.list_users(db, limit, offset)


@router.post("", response_model=UserOut, status_code=201, summary="Create a user (Admin)")
def create_user(
    body: UserCreate,
    _: object = Depends(require_permission(Permission.MANAGE_USERS)),
    db: Session = Depends(get_db),
) -> UserOut:
    return user_service.create_user(db, body)


@router.patch("/{user_id}/role", response_model=UserOut, summary="Change a user's role (Admin)")
def update_role(
    user_id: int,
    body: RoleUpdate,
    _: object = Depends(require_permission(Permission.CHANGE_ROLES)),
    db: Session = Depends(get_db),
) -> UserOut:
    return user_service.change_role(db, user_id, body.role)


@router.patch("/{user_id}/status", response_model=UserOut, summary="Enable or disable a user (Admin)")
def update_status(
    user_id: int,
    body: StatusUpdate,
    _: object = Depends(require_permission(Permission.MANAGE_USERS)),
    db: Session = Depends(get_db),
) -> UserOut:
    return user_service.change_status(db, user_id, body.status)