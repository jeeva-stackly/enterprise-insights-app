from sqlalchemy.orm import Session

from app.repositories import customers as customers_repo
from app.schemas.common import Page
from app.schemas.customer import CustomerOut


def list_customers(db: Session, limit: int, offset: int, status: str | None) -> Page[CustomerOut]:
    rows, total = customers_repo.list_customers(db, limit, offset, status)
    items = [
        CustomerOut(
            id=c.id, name=c.name, email=c.email, registered_at=c.registered_at, status=c.status
        )
        for c in rows
    ]
    return Page[CustomerOut](items=items, total=total, limit=limit, offset=offset)