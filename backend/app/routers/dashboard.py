from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Get dashboard data",
    description="KPIs, analytics preview and recent activity, all calculated from PostgreSQL.",
)
def read_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    return dashboard_service.get_dashboard(db)