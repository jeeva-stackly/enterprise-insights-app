from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import RevenueTrendResponse
from app.services import analytics_service
from app.utils.dates import resolve_date_range, utc_today

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


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