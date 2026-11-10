from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Order, Product


def list_orders(db: Session, limit: int, offset: int, status: str | None) -> tuple[list[Order], int]:
    """One page of orders (newest first) plus the total number of matching rows.

    LIMIT/OFFSET and the status filter are applied by PostgreSQL; the related customer,
    product and category are loaded in the same query (JOIN), avoiding N+1 queries.
    """
    filters = [Order.status == status] if status else []

    page = (
        select(Order)
        .options(joinedload(Order.customer), joinedload(Order.product).joinedload(Product.category))
        .where(*filters)
        .order_by(Order.ordered_at.desc(), Order.id.desc())
        .limit(limit)
        .offset(offset)
    )
    total = db.scalar(select(func.count()).select_from(Order).where(*filters)) or 0
    return list(db.scalars(page).unique().all()), total


def get_order(db: Session, order_id: int) -> Order | None:
    stmt = (
        select(Order)
        .options(joinedload(Order.customer), joinedload(Order.product).joinedload(Product.category))
        .where(Order.id == order_id)
    )
    return db.scalars(stmt).unique().first()


def next_order_number(db: Session) -> str:
    """ORD1001, ORD1002, ... continuing after the highest existing number."""
    suffix = cast(func.substr(Order.order_number, 4), Integer)
    current = db.scalar(select(func.max(suffix)).where(Order.order_number.like("ORD%")))
    return f"ORD{(current or 1000) + 1}"