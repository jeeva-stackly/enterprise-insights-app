from sqlalchemy.orm import Session

from app.repositories import orders as orders_repo
from app.schemas.common import Page
from app.schemas.order import OrderOut


def list_orders(db: Session, limit: int, offset: int, status: str | None) -> Page[OrderOut]:
    rows, total = orders_repo.list_orders(db, limit, offset, status)
    items = [
        OrderOut(
            id=o.id,
            order_number=o.order_number,
            ordered_at=o.ordered_at,
            customer_id=o.customer_id,
            customer_name=o.customer.name,
            product_name=o.product.name,
            category=o.product.category.name,
            quantity=o.quantity,
            total_amount=float(o.total_amount),
            status=o.status,
        )
        for o in rows
    ]
    return Page[OrderOut](items=items, total=total, limit=limit, offset=offset)