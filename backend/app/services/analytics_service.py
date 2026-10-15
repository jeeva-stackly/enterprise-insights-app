from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories import analytics as analytics_repo
from app.schemas.analytics import RevenuePoint, RevenueTrendResponse
from app.utils.dates import range_bounds


def get_revenue_trend(db: Session, start: date, end: date) -> RevenueTrendResponse:
    """Daily revenue for the inclusive range [start, end].

    The database does the filtering and grouping. Days that have no orders are not rows in the
    result, so they are filled with zero here to give charts a continuous, predictable series.
    """
    start_dt, end_dt = range_bounds(start, end)
    by_day = {row.day: row for row in analytics_repo.daily_revenue(db, start_dt, end_dt)}

    points: list[RevenuePoint] = []
    total = Decimal(0)
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        row = by_day.get(day)
        revenue = row.revenue if row else Decimal(0)
        total += revenue
        points.append(
            RevenuePoint(date=day, revenue=float(revenue), completed_orders=row.completed_orders if row else 0)
        )

    return RevenueTrendResponse(start_date=start, end_date=end, total_revenue=float(total), points=points)