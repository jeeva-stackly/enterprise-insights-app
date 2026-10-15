from datetime import datetime
from decimal import Decimal

from app.utils.dates import as_utc, utc_now


def format_inr(amount: Decimal) -> str:
    """Rupees with Indian digit grouping: 112000 -> ₹1,12,000."""
    n = int(round(amount))
    digits = str(abs(n))
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups: list[str] = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups + [tail])
    return f"₹{'-' if n < 0 else ''}{digits}"


def time_ago(moment: datetime, now: datetime | None = None) -> str:
    """Relative label for the activity feed: '5 min ago', '2 hours ago', 'Yesterday'."""
    now = now or utc_now()
    seconds = max(int((as_utc(now) - as_utc(moment)).total_seconds()), 0)
    if seconds < 60:
        return "Just now"
    if seconds < 3600:
        return f"{seconds // 60} min ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    if seconds < 172800:
        return "Yesterday"
    return f"{seconds // 86400} days ago"