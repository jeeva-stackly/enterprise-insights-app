from datetime import datetime
from typing import Literal

from pydantic import Field

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


class OrderCreate(ApiModel):
    """A new order always starts as `pending`; the price is taken from the product, not from the client."""

    customer_id: int = Field(gt=0)
    product_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=1000)


class OrderStatusUpdate(ApiModel):
    status: OrderStatus