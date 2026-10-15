"""SQLAlchemy models (persistent storage). API response shapes live in app/schemas instead.

Importing every model here guarantees Base.metadata knows all tables, which Alembic needs.
"""

from app.models.activity import Activity
from app.models.category import Category
from app.models.customer import Customer
from app.models.order import Order
from app.models.product import Product

__all__ = ["Activity", "Category", "Customer", "Order", "Product"]