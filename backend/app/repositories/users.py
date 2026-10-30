from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def list_users(db: Session, limit: int, offset: int) -> tuple[list[User], int]:
    total = db.scalar(select(func.count()).select_from(User)) or 0
    items = db.scalars(select(User).order_by(User.id).limit(limit).offset(offset)).all()
    return list(items), total


def count_active_admins(db: Session, exclude_id: int | None = None) -> int:
    stmt = select(func.count()).select_from(User).where(User.role == "admin", User.status == "active")
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return db.scalar(stmt) or 0