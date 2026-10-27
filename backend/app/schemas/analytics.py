import datetime as dt
from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel


class RevenuePoint(ApiModel):
    date: dt.date
    revenue: float
    completed_orders: int


class RevenueTrendResponse(ApiModel):
    """Always has one point per calendar day in [start_date, end_date] (zero-filled),
    so the shape is identical whether or not any orders matched."""

    start_date: dt.date
    end_date: dt.date
    total_revenue: float
    points: list[RevenuePoint]


# ---------- GET /api/analytics/overview ----------
ComparisonPeriod = Literal["previous_period", "previous_year"]
Direction = Literal["up", "down", "flat"]
Granularity = Literal["hour", "day"]


class ComparisonMetric(ApiModel):
    """A number for the selected range next to the same number for the comparison range.

    change_percent is null (not 0, not infinity) when the comparison value is 0, because a
    percentage of zero is undefined. `direction` still tells the app whether it went up.
    """

    current: float
    previous: float
    change_percent: float | None
    direction: Direction


class OverviewRange(ApiModel):
    start_date: dt.date
    end_date: dt.date
    days: int
    comparison_period: ComparisonPeriod
    previous_start_date: dt.date
    previous_end_date: dt.date
    granularity: Granularity


class OverviewMetrics(ApiModel):
    revenue: ComparisonMetric
    orders: ComparisonMetric
    profit: ComparisonMetric
    customers: ComparisonMetric
    average_order_value: ComparisonMetric


class OverviewTrendPoint(ApiModel):
    bucket: str = Field(description="YYYY-MM-DD for daily points, HH:00 for hourly points.")
    revenue: float
    orders: int = Field(description="Completed orders in this bucket.")


class StatusBreakdownItem(ApiModel):
    status: str
    count: int
    percent: float = Field(description="Share of all orders in the range (0-100).")


class OverviewTopCategory(ApiModel):
    name: str
    revenue: float
    share_percent: float
    previous_revenue: float
    change_percent: float | None
    direction: Direction


class AnalyticsOverviewResponse(ApiModel):
    range: OverviewRange
    metrics: OverviewMetrics
    trend: list[OverviewTrendPoint]
    status_breakdown: list[StatusBreakdownItem]
    top_category: OverviewTopCategory | None
    total_orders: int = Field(description="All orders in the range, any status. 0 means an empty range.")
    is_empty: bool