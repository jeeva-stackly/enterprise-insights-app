"""Run the revenue-target and low-sales checks once.  Usage (from backend/):  python -m scripts.run_alert_checks

Meant for a daily cron job or a manual run. Running it twice for the same period creates no duplicates.
"""

from app.db.session import SessionLocal
from app.services import notification_service


def main() -> None:
    with SessionLocal() as db:
        created = notification_service.run_period_checks(db)
    print(f"Created {len(created)} notification(s).")


if __name__ == "__main__":
    main()