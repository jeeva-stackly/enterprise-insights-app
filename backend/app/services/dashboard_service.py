"""Dashboard business rules. See README "KPI definitions" for the plain-language version.

Reporting period: the last KPI_PERIOD_DAYS calendar days including today (UTC), compared with
the immediately preceding window of the same length. Only completed orders count as revenue.
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories import activities as activities_repo
from app.repositories import analytics as analytics_repo
from app.schemas.dashboard import (
    Analytics,
    DashboardResponse,
    KpiData,
    Kpis,
    OrdersSummary,
    RecentActivity,
    RevenueTrend,
    TopCategory,
    TrendPoint,
    UserProfile,
)
from app.services import analytics_service
from app.utils.dates import percent_change, range_bounds, utc_now, utc_today
from app.utils.formatting import format_inr, time_ago

ACTIVITY_TITLES = {
    "order": "New order received",
    "target": "Sales target updated",
    "customer": "New customer registered",
    "payment": "Payment settled",
    "alert": "Alert",
}


def get_dashboard(db: Session, today: date | None = None) -> DashboardResponse:
    settings = get_settings()
    today = today or utc_today()
    days = settings.kpi_period_days

    cur_start, cur_end = range_bounds(today - timedelta(days=days - 1), today)
    prev_start, prev_end = range_bounds(today - timedelta(days=2 * days - 1), today - timedelta(days=days))

    current = analytics_repo.period_stats(db, cur_start, cur_end)
    previous = analytics_repo.period_stats(db, prev_start, prev_end)

    kpis = Kpis(
        revenue=KpiData(value=float(current.revenue), change=percent_change(current.revenue, previous.revenue)),
        orders=KpiData(
            value=current.qualifying_orders,
            change=percent_change(Decimal(current.qualifying_orders), Decimal(previous.qualifying_orders)),
        ),
        customers=KpiData(
            value=current.active_customers,
            change=percent_change(Decimal(current.active_customers), Decimal(previous.active_customers)),
        ),
        profit=KpiData(value=float(current.profit), change=percent_change(current.profit, previous.profit)),
    )

    trend = analytics_service.get_revenue_trend(db, today - timedelta(days=settings.trend_days - 1), today)
    revenue_trend = RevenueTrend(
        period_label=f"Last {settings.trend_days} days",
        points=[TrendPoint(label=p.date.strftime("%a"), value=p.revenue) for p in trend.points],
    )

    average = current.revenue / current.completed if current.completed else Decimal(0)
    orders_summary = OrdersSummary(
        total_orders=current.total_orders,
        completed_orders=current.completed,
        pending_orders=current.pending,
        cancelled_orders=current.cancelled,
        average_order_value=round(float(average)),
    )

    return DashboardResponse(
        user=UserProfile(
            id=settings.default_user_id,
            name=settings.default_user_name,
            role=settings.default_user_role,
            unread_notifications=activities_repo.count_alerts_since(db, utc_now() - timedelta(days=7)),
        ),
        kpis=kpis,
        analytics=Analytics(
            revenue_trend=revenue_trend,
            orders_summary=orders_summary,
            top_category=_top_category(db, current.revenue, cur_start, cur_end, prev_start, prev_end),
        ),
        recent_activities=_recent_activities(db, settings.recent_activity_limit),
    )


def _top_category(db: Session, total_revenue: Decimal, cur_start, cur_end, prev_start, prev_end) -> TopCategory:
    top = analytics_repo.top_category(db, cur_start, cur_end)
    if top is None:  # no completed sales in the period: still a valid, consistent payload
        return TopCategory(name="No sales yet", revenue=0, share_percent=0, change=0)

    previous = analytics_repo.category_revenue(db, top.id, prev_start, prev_end)
    share = min(float(top.revenue / total_revenue * 100), 100.0) if total_revenue else 0.0
    return TopCategory(
        name=top.name,
        revenue=float(top.revenue),
        share_percent=round(share, 1),
        change=percent_change(top.revenue, previous),
    )


def _recent_activities(db: Session, limit: int) -> list[RecentActivity]:
    now = utc_now()
    return [
        RecentActivity(
            id=str(activity.id),
            type=activity.activity_type,
            title=ACTIVITY_TITLES[activity.activity_type],
            subtitle=activity.description,
            detail=format_inr(amount) if amount is not None else None,
            time_ago=time_ago(activity.created_at, now),
        )
        for activity, amount in activities_repo.fetch_activities(db, limit)
    ]