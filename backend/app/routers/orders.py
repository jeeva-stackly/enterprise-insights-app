from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers.deps import Limit, Offset
from app.schemas.common import Page
from app.schemas.order import OrderOut, OrderStatus
from app.services import order_service

router = APIRouter(prefix="/api", tags=["Orders"])


@router.get("/orders", response_model=Page[OrderOut], summary="List orders (paginated, newest first)")
def read_orders(
    limit: Limit = 20,
    offset: Offset = 0,
    status: OrderStatus | None = Query(default=None, description="Filter by order status."),
    db: Session = Depends(get_db),
) -> Page[OrderOut]:
    return order_service.list_orders(db, limit, offset, status)