from sqlalchemy.orm import Session

from app.repositories import activities as activities_repo
from app.schemas.activity import ActivityOut
from app.schemas.common import Page


def list_activities(db: Session, limit: int, offset: int) -> Page[ActivityOut]:
    rows = activities_repo.fetch_activities(db, limit, offset)
    items = [
        ActivityOut(
            id=a.id,
            activity_type=a.activity_type,
            description=a.description,
            reference_type=a.reference_type,
            reference_id=a.reference_id,
            created_at=a.created_at,
        )
        for a, _amount in rows
    ]
    return Page[ActivityOut](
        items=items, total=activities_repo.count_activities(db), limit=limit, offset=offset
    )