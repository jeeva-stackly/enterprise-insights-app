"""Date helpers. Everything is UTC, and ranges are half-open: [start, end)."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

MAX_RANGE_DAYS = 366


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_today() -> date:
    return utc_now().date()


def day_start(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def range_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Inclusive calendar days -> [start 00:00, day-after-end 00:00) for SQL filtering."""
    return day_start(start), day_start(end + timedelta(days=1))


def as_utc(value: datetime) -> datetime:
    """Treat naive datetimes (e.g. from SQLite) as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def resolve_date_range(
    start: date | None, end: date | None, today: date, default_days: int = 7
) -> tuple[date, date]:
    """Fill in missing bounds and validate. Raises ValueError with a user-safe message."""
    if start is None and end is None:
        end = today
        start = today - timedelta(days=default_days - 1)
    elif end is None:
        end = today
    elif start is None:
        start = end - timedelta(days=default_days - 1)

    assert start is not None and end is not None
    if start > end:
        raise ValueError("start_date must be on or before end_date.")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ValueError(f"The date range cannot exceed {MAX_RANGE_DAYS} days.")
    return start, end


def percent_change(current: Decimal, previous: Decimal) -> float:
    """Change vs the previous period, in percent. 0.0 when there is no baseline to compare."""
    if previous == 0:
        return 0.0
    return round(float((current - previous) / previous * 100), 1)