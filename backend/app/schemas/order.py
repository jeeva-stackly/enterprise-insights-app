from datetime import datetime
from typing import Literal

from app.schemas.base import ApiModel

OrderStatus = Literal["completed", "pending", "cancelled"]


class OrderOut(ApiModel):
    """Only the fields a client needs; internal ids of product/category are not exposed."""

    id: int
    order_number: str
    ordered_at: datetime
    customer_id: int
    customer_name: str
    product_name: str
    category: str
    quantity: int
    total_amount: float
    status: OrderStatus