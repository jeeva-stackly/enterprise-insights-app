from sqlalchemy import func, select
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