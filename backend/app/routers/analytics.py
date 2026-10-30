from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import AnalyticsOverviewResponse, ComparisonPeriod, RevenueTrendResponse
from app.services import analytics_service
from app.utils.dates import resolve_date_range, utc_today
from app.core.auth import require_permission
from app.core.permissions import Permission

router = APIRouter(prefix="/api/analytics", tags=["Analytics"], dependencies=[Depends(require_permission(Permission.VIEW_ANALYTICS))])


@router.get(
    "/revenue-trend",
    response_model=RevenueTrendResponse,
    summary="Daily revenue between two dates",
    description=(
        "Completed-order revenue per day. Defaults to the last 7 days. Both dates are inclusive "
        "(YYYY-MM-DD, UTC); the range may not exceed 366 days."
    ),
)
def read_revenue_trend(
    start_date: date | None = Query(default=None, description="First day, e.g. 2026-10-01."),
    end_date: date | None = Query(default=None, description="Last day, e.g. 2026-10-12."),
    db: Session = Depends(get_db),
) -> RevenueTrendResponse:
    try:
        start, end = resolve_date_range(start_date, end_date, today=utc_today())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return analytics_service.get_revenue_trend(db, start, end)


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Analytics overview for a date range",
    description=(
        "Revenue, orders, profit, customers, trend, order-status breakdown and top category for "
        "the inclusive UTC range, each compared with the previous period. `comparison_period` is "
        "`previous_period` (same length, immediately before; default) or `previous_year`. "
        "`change_percent` is null when the comparison value is 0. A single-day range returns "
        "24 hourly points, otherwise one point per day."
    ),
)
def read_overview(
    start_date: date | None = Query(default=None, description="First day, e.g. 2026-10-01 (default: 6 days before end)."),
    end_date: date | None = Query(default=None, description="Last day, e.g. 2026-10-07 (default: today, UTC)."),
    comparison_period: ComparisonPeriod = Query(default="previous_period"),
    db: Session = Depends(get_db),
) -> AnalyticsOverviewResponse:
    try:
        start, end = resolve_date_range(start_date, end_date, today=utc_today())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return analytics_service.get_overview(db, start, end, comparison_period)