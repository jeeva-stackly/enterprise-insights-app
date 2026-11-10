from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Order
from app.repositories import customers as customers_repo
from app.repositories import orders as orders_repo
from app.repositories import products as products_repo
from app.schemas.common import Page
from app.schemas.order import OrderCreate, OrderOut
from app.services import notification_service
from app.services.errors import ConflictError, NotFoundError
from app.utils.dates import utc_now


def _to_out(o: Order) -> OrderOut:
    return OrderOut(
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


def list_orders(db: Session, limit: int, offset: int, status: str | None) -> Page[OrderOut]:
    rows, total = orders_repo.list_orders(db, limit, offset, status)
    return Page[OrderOut](items=[_to_out(o) for o in rows], total=total, limit=limit, offset=offset)


def create_order(db: Session, data: OrderCreate) -> OrderOut:
    customer = customers_repo.get_by_id(db, data.customer_id)
    if customer is None:
        raise NotFoundError("Customer not found.")
    if customer.status != "active":
        raise ConflictError("This customer is inactive and cannot place orders.")
    product = products_repo.get_by_id(db, data.product_id)
    if product is None:
        raise NotFoundError("Product not found.")
    if product.status != "active":
        raise ConflictError("This product is discontinued and cannot be ordered.")

    order = None
    for _ in range(3):  # a second order created at the same instant may take our number: retry
        order = Order(
            order_number=orders_repo.next_order_number(db),
            customer_id=customer.id,
            product_id=product.id,
            ordered_at=utc_now(),
            quantity=data.quantity,
            total_amount=product.unit_price * data.quantity,  # price comes from the product, never the client
            status="pending",
        )
        db.add(order)
        try:
            db.commit()
            break
        except IntegrityError:
            db.rollback()
            order = None
    if order is None:
        raise ConflictError("Could not allocate an order number. Please try again.")

    notification_service.on_order_created(db, order)
    created = orders_repo.get_order(db, order.id)
    assert created is not None
    return _to_out(created)


def update_status(db: Session, order_id: int, status: str) -> OrderOut:
    order = orders_repo.get_order(db, order_id)
    if order is None:
        raise NotFoundError("Order not found.")
    if order.status != "pending" or status not in ("completed", "cancelled"):
        raise ConflictError(
            f"An order that is {order.status} cannot be changed to {status}. "
            "Only pending orders can be completed or cancelled."
        )
    order.status = status
    db.commit()
    notification_service.on_order_status_changed(db, order)
    refreshed = orders_repo.get_order(db, order_id)
    assert refreshed is not None
    return _to_out(refreshed)