import datetime as dt

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