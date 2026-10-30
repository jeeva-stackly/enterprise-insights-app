from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User
from app.models.constants import Role, UserStatus
from app.repositories import users as users_repo
from app.schemas.auth import UserOut
from app.schemas.common import Page
from app.schemas.user import UserCreate
from app.services.auth_service import to_user_out
from app.services.errors import ConflictError, NotFoundError

LAST_ADMIN_MESSAGE = "At least one active administrator is required. Make another user an active admin first."


def list_users(db: Session, limit: int, offset: int) -> Page[UserOut]:
    items, total = users_repo.list_users(db, limit, offset)
    return Page[UserOut](items=[to_user_out(u) for u in items], total=total, limit=limit, offset=offset)


def create_user(db: Session, data: UserCreate) -> UserOut:
    if users_repo.get_by_email(db, data.email):
        raise ConflictError("A user with this email already exists.")
    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role.value,
        status=UserStatus.ACTIVE.value,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two admins creating the same email at the same moment
        db.rollback()
        raise ConflictError("A user with this email already exists.") from None
    db.refresh(user)
    return to_user_out(user)


def change_role(db: Session, user_id: int, role: Role) -> UserOut:
    user = _get_or_404(db, user_id)
    if user.role == Role.ADMIN and role != Role.ADMIN and user.is_active:
        _ensure_another_admin(db, user)
    user.role = role.value
    db.commit()
    return to_user_out(user)


def change_status(db: Session, user_id: int, status: UserStatus) -> UserOut:
    user = _get_or_404(db, user_id)
    if user.role == Role.ADMIN and user.is_active and status == UserStatus.DISABLED:
        _ensure_another_admin(db, user)
    user.status = status.value
    db.commit()
    return to_user_out(user)


def _get_or_404(db: Session, user_id: int) -> User:
    user = users_repo.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found.")
    return user


def _ensure_another_admin(db: Session, user: User) -> None:
    """Demoting/disabling `user` must never leave the system without an active administrator."""
    if users_repo.count_active_admins(db, exclude_id=user.id) == 0:
        raise ConflictError(LAST_ADMIN_MESSAGE)