from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_permission
from app.core.permissions import Permission
from app.db.session import get_db
from app.models import User
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Get dashboard data",
    description="KPIs, analytics preview and recent activity, all calculated from PostgreSQL. Requires login.",
)
def read_dashboard(
    user: User = Depends(require_permission(Permission.VIEW_DASHBOARD)),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    return dashboard_service.get_dashboard(db, user=user)