from datetime import datetime

from app.schemas.base import ApiModel


class ActivityOut(ApiModel):
    """Raw activity record for GET /api/activities. (The dashboard uses the UI-shaped
    RecentActivity from schemas/dashboard.py instead.)"""

    id: int
    activity_type: str
    description: str
    reference_type: str | None = None
    reference_id: int | None = None
    created_at: datetime