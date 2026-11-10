from sqlalchemy.orm import Session

from app.models import Product


def get_by_id(db: Session, product_id: int) -> Product | None:
    return db.get(Product, product_id)
