from fastapi import APIRouter, Depends, Query, status as http_status
from sqlalchemy.orm import Session

from app.core.auth import require_permission
from app.core.permissions import Permission

from app.db.session import get_db
from app.routers.deps import Limit, Offset
from app.schemas.common import Page
from app.schemas.order import OrderCreate, OrderOut, OrderStatus, OrderStatusUpdate
from app.services import order_service

router = APIRouter(prefix="/api", tags=["Orders"], dependencies=[Depends(require_permission(Permission.VIEW_ANALYTICS))])


@router.get("/orders", response_model=Page[OrderOut], summary="List orders (paginated, newest first)")
def read_orders(
    limit: Limit = 20,
    offset: Offset = 0,
    status: OrderStatus | None = Query(default=None, description="Filter by order status."),
    db: Session = Depends(get_db),
) -> Page[OrderOut]:
    return order_service.list_orders(db, limit, offset, status)


@router.post(
    "/orders",
    response_model=OrderOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a pending order (admin / analyst)",
    dependencies=[Depends(require_permission(Permission.MANAGE_ORDERS))],
)
def create_order(data: OrderCreate, db: Session = Depends(get_db)) -> OrderOut:
    return order_service.create_order(db, data)


@router.patch(
    "/orders/{order_id}/status",
    response_model=OrderOut,
    summary="Complete or cancel a pending order (admin / analyst)",
    dependencies=[Depends(require_permission(Permission.MANAGE_ORDERS))],
)
def update_order_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db)) -> OrderOut:
    return order_service.update_status(db, order_id, data.status)