"""Aggregate SQL for the dashboard and analytics endpoints.

Every filter and aggregation runs inside the database (WHERE / GROUP BY / SUM / COUNT).
Nothing is fetched and filtered in Python. Repositories return plain values/dataclasses,
never API schemas.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, NamedTuple

from sqlalchemy import Date, case, distinct, func, select
from sqlalchemy.orm import Session

from app.models import Category, Order, Product

COMPLETED = Order.status == "completed"
PENDING = Order.status == "pending"
CANCELLED = Order.status == "cancelled"


def _dec(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or 0))


@dataclass(frozen=True)
class PeriodStats:
    revenue: Decimal  # SUM(total_amount) of completed orders
    cost: Decimal  # SUM(quantity * unit_cost) of the same completed orders
    completed: int
    pending: int
    cancelled: int
    active_customers: int  # distinct customers with at least one non-cancelled order

    @property
    def profit(self) -> Decimal:
        return self.revenue - self.cost

    @property
    def qualifying_orders(self) -> int:
        return self.completed + self.pending

    @property
    def total_orders(self) -> int:
        return self.completed + self.pending + self.cancelled


def period_stats(db: Session, start: datetime, end: datetime) -> PeriodStats:
    """All headline numbers for orders placed in [start, end), computed in ONE query."""
    stmt = (
        select(
            func.coalesce(func.sum(case((COMPLETED, Order.total_amount), else_=0)), 0),
            func.coalesce(func.sum(case((COMPLETED, Order.quantity * Product.unit_cost), else_=0)), 0),
            func.coalesce(func.sum(case((COMPLETED, 1), else_=0)), 0),
            func.coalesce(func.sum(case((PENDING, 1), else_=0)), 0),
            func.coalesce(func.sum(case((CANCELLED, 1), else_=0)), 0),
            # CASE without ELSE yields NULL for cancelled orders, and COUNT(DISTINCT) skips NULLs.
            func.count(distinct(case((Order.status != "cancelled", Order.customer_id)))),
        )
        .select_from(Order)
        .join(Product, Product.id == Order.product_id)
        .where(Order.ordered_at >= start, Order.ordered_at < end)
    )
    revenue, cost, completed, pending, cancelled, customers = db.execute(stmt).one()
    return PeriodStats(
        revenue=_dec(revenue),
        cost=_dec(cost),
        completed=int(completed),
        pending=int(pending),
        cancelled=int(cancelled),
        active_customers=int(customers),
    )


class DailyRevenue(NamedTuple):
    day: date
    revenue: Decimal
    completed_orders: int


def daily_revenue(db: Session, start: datetime, end: datetime) -> list[DailyRevenue]:
    """Completed revenue grouped by calendar day (UTC). Days without orders are absent here."""
    day = func.date(Order.ordered_at, type_=Date).label("day")
    stmt = (
        select(
            day,
            func.coalesce(func.sum(case((COMPLETED, Order.total_amount), else_=0)), 0),
            func.coalesce(func.sum(case((COMPLETED, 1), else_=0)), 0),
        )
        .where(Order.ordered_at >= start, Order.ordered_at < end)
        .group_by(day)
        .order_by(day)
    )
    return [DailyRevenue(d, _dec(rev), int(n)) for d, rev, n in db.execute(stmt).all()]


class CategoryRevenue(NamedTuple):
    id: int
    name: str
    revenue: Decimal


def top_category(db: Session, start: datetime, end: datetime) -> CategoryRevenue | None:
    """Category with the highest completed revenue in the period (ties broken by name)."""
    revenue = func.sum(Order.total_amount).label("revenue")
    stmt = (
        select(Category.id, Category.name, revenue)
        .select_from(Order)
        .join(Product, Product.id == Order.product_id)
        .join(Category, Category.id == Product.category_id)
        .where(COMPLETED, Order.ordered_at >= start, Order.ordered_at < end)
        .group_by(Category.id, Category.name)
        .order_by(revenue.desc(), Category.name)
        .limit(1)
    )
    row = db.execute(stmt).first()
    return CategoryRevenue(row[0], row[1], _dec(row[2])) if row else None


def category_revenue(db: Session, category_id: int, start: datetime, end: datetime) -> Decimal:
    stmt = (
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .select_from(Order)
        .join(Product, Product.id == Order.product_id)
        .where(
            COMPLETED,
            Product.category_id == category_id,
            Order.ordered_at >= start,
            Order.ordered_at < end,
        )
    )
    return _dec(db.scalar(stmt))