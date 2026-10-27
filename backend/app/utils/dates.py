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
def shift_years(d: date, years: int) -> date:
    """Same calendar day `years` earlier/later (29 Feb falls back to 28 Feb)."""
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)


def previous_range(start: date, end: date, comparison: str) -> tuple[date, date]:
    """The comparison range: the same length right before `start`, or the same dates a year ago."""
    if comparison == "previous_year":
        return shift_years(start, -1), shift_years(end, -1)
    days = (end - start).days + 1
    return start - timedelta(days=days), start - timedelta(days=1)


def change_percent(current: Decimal, previous: Decimal) -> float | None:
    """Percent change, or None when the previous value is 0 (undefined, never divide by zero)."""
    if previous == 0:
        return None
    return round(float((current - previous) / previous * 100), 1)


def direction_of(current: Decimal, previous: Decimal) -> str:
    if current > previous:
        return "up"
    if current < previous:
        return "down"
    return "flat"