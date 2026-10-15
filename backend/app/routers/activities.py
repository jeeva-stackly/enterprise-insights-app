from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers.deps import Limit, Offset
from app.schemas.activity import ActivityOut
from app.schemas.common import Page
from app.services import activity_service

router = APIRouter(prefix="/api", tags=["Activities"])


@router.get("/activities", response_model=Page[ActivityOut], summary="Recent business activities (newest first)")
def read_activities(limit: Limit = 10, offset: Offset = 0, db: Session = Depends(get_db)) -> Page[ActivityOut]:
    return activity_service.list_activities(db, limit, offset)