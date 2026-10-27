from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.constants import ORDER_STATUSES
from app.repositories import analytics as analytics_repo
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    ComparisonMetric,
    OverviewMetrics,
    OverviewRange,
    OverviewTopCategory,
    OverviewTrendPoint,
    RevenuePoint,
    RevenueTrendResponse,
    StatusBreakdownItem,
)
from app.utils.dates import change_percent, direction_of, previous_range, range_bounds


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


# ---------- overview ----------


def _metric(current: Decimal, previous: Decimal) -> ComparisonMetric:
    return ComparisonMetric(
        current=float(current),
        previous=float(previous),
        change_percent=change_percent(current, previous),
        direction=direction_of(current, previous),  # type: ignore[arg-type]
    )


def _avg(revenue: Decimal, completed: int) -> Decimal:
    return (revenue / completed).quantize(Decimal("0.01")) if completed else Decimal(0)


def _trend(db: Session, start: date, end: date) -> list[OverviewTrendPoint]:
    start_dt, end_dt = range_bounds(start, end)
    if start == end:
        hours = {r.hour: r for r in analytics_repo.hourly_revenue(db, start_dt, end_dt)}
        return [
            OverviewTrendPoint(
                bucket=f"{h:02d}:00",
                revenue=float(hours[h].revenue) if h in hours else 0.0,
                orders=hours[h].completed_orders if h in hours else 0,
            )
            for h in range(24)
        ]
    days = {r.day: r for r in analytics_repo.daily_revenue(db, start_dt, end_dt)}
    out: list[OverviewTrendPoint] = []
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        row = days.get(day)
        out.append(
            OverviewTrendPoint(
                bucket=day.isoformat(),
                revenue=float(row.revenue) if row else 0.0,
                orders=row.completed_orders if row else 0,
            )
        )
    return out


def get_overview(db: Session, start: date, end: date, comparison: str = "previous_period") -> AnalyticsOverviewResponse:
    """Everything the Analytics screen needs for [start, end] in one response.

    Rules (same as the dashboard): revenue = completed total_amount; profit = revenue - cost;
    orders = completed + pending; customers = distinct customers with a non-cancelled order.
    """
    prev_start, prev_end = previous_range(start, end, comparison)
    cur_dt = range_bounds(start, end)
    prev_dt = range_bounds(prev_start, prev_end)

    cur = analytics_repo.period_stats(db, *cur_dt)
    prev = analytics_repo.period_stats(db, *prev_dt)

    metrics = OverviewMetrics(
        revenue=_metric(cur.revenue, prev.revenue),
        orders=_metric(Decimal(cur.qualifying_orders), Decimal(prev.qualifying_orders)),
        profit=_metric(cur.profit, prev.profit),
        customers=_metric(Decimal(cur.active_customers), Decimal(prev.active_customers)),
        average_order_value=_metric(_avg(cur.revenue, cur.completed), _avg(prev.revenue, prev.completed)),
    )

    counts = {"completed": cur.completed, "pending": cur.pending, "cancelled": cur.cancelled}
    total = cur.total_orders
    breakdown = [
        StatusBreakdownItem(
            status=s,
            count=counts[s],
            percent=round(counts[s] / total * 100, 1) if total else 0.0,
        )
        for s in ORDER_STATUSES
    ]

    top = analytics_repo.top_category(db, *cur_dt)
    top_out: OverviewTopCategory | None = None
    if top is not None:
        prev_rev = analytics_repo.category_revenue(db, top.id, *prev_dt)
        top_out = OverviewTopCategory(
            name=top.name,
            revenue=float(top.revenue),
            share_percent=round(float(top.revenue / cur.revenue * 100), 1) if cur.revenue else 0.0,
            previous_revenue=float(prev_rev),
            change_percent=change_percent(top.revenue, prev_rev),
            direction=direction_of(top.revenue, prev_rev),  # type: ignore[arg-type]
        )

    return AnalyticsOverviewResponse(
        range=OverviewRange(
            start_date=start,
            end_date=end,
            days=(end - start).days + 1,
            comparison_period=comparison,  # type: ignore[arg-type]
            previous_start_date=prev_start,
            previous_end_date=prev_end,
            granularity="hour" if start == end else "day",
        ),
        metrics=metrics,
        trend=_trend(db, start, end),
        status_breakdown=breakdown,
        top_category=top_out,
        total_orders=total,
        is_empty=total == 0,
    )