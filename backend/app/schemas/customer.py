from datetime import date
from typing import Literal

from app.schemas.base import ApiModel

CustomerStatus = Literal["active", "inactive"]


class CustomerOut(ApiModel):
    id: int
    name: str
    email: str
    registered_at: date
    status: CustomerStatus