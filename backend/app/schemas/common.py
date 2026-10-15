from typing import Generic, TypeVar

from app.schemas.base import ApiModel

T = TypeVar("T")


class Page(ApiModel, Generic[T]):
    """Standard envelope for paginated lists. An empty result is a normal 200 with items = []."""

    items: list[T]
    total: int
    limit: int
    offset: int