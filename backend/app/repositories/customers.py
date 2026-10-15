from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Customer


def list_customers(db: Session, limit: int, offset: int, status: str | None) -> tuple[list[Customer], int]:
    filters = [Customer.status == status] if status else []

    page = select(Customer).where(*filters).order_by(Customer.id).limit(limit).offset(offset)
    total = db.scalar(select(func.count()).select_from(Customer).where(*filters)) or 0
    return list(db.scalars(page).all()), total