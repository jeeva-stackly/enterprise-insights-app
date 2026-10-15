from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers.deps import Limit, Offset
from app.schemas.common import Page
from app.schemas.customer import CustomerOut, CustomerStatus
from app.services import customer_service

router = APIRouter(prefix="/api", tags=["Customers"])


@router.get("/customers", response_model=Page[CustomerOut], summary="List customers (paginated)")
def read_customers(
    limit: Limit = 20,
    offset: Offset = 0,
    status: CustomerStatus | None = Query(default=None, description="Filter by customer status."),
    db: Session = Depends(get_db),
) -> Page[CustomerOut]:
    return customer_service.list_customers(db, limit, offset, status)