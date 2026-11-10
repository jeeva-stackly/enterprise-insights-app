"""PURE alert rules: numbers in, an optional notification draft out. No database, no HTTP, no clock.

Keeping the rules pure makes them trivial to unit test; notification_service.py decides WHO receives
a draft and stores it. `dedupe_key` identifies the business event: the same key never produces a
second notification for the same user.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.core.permissions import Permission
from app.utils.formatting import format_inr


@dataclass(frozen=True)
class NotificationDraft:
    title: str
    message: str
    type: str  # revenue | sales | order | customer | system
    priority: str  # low | medium | high | critical
    audience: Permission  # only roles holding this permission receive it
    dedupe_key: str
    related_entity_type: str | None = None
    related_entity_id: int | None = None


def high_value_order(order_id: int, order_number: str, amount: Decimal, threshold: Decimal) -> NotificationDraft | None:
    if amount < threshold:
        return None
    return NotificationDraft(
        title="High-Value Order Received",
        message=f"A new order worth {format_inr(amount)} has been received ({order_number}).",
        type="order",
        priority="high",
        audience=Permission.VIEW_OPERATIONAL_ALERTS,
        dedupe_key=f"order-high-value:{order_id}",
        related_entity_type="order",
        related_entity_id=order_id,
    )


def order_status_changed(order_id: int, order_number: str, status: str, amount: Decimal) -> NotificationDraft | None:
    """Only Completed and Cancelled are important enough to notify about."""
    if status == "completed":
        title, priority = "Order Completed", "low"
        message = f"Order {order_number} worth {format_inr(amount)} has been completed."
    elif status == "cancelled":
        title, priority = "Order Cancelled", "medium"
        message = f"Order {order_number} worth {format_inr(amount)} has been cancelled."
    else:
        return None
    return NotificationDraft(
        title=title,
        message=message,
        type="order",
        priority=priority,
        audience=Permission.VIEW_OPERATIONAL_ALERTS,
        dedupe_key=f"order-status:{order_id}:{status}",
        related_entity_type="order",
        related_entity_id=order_id,
    )


def _period_label(start: date, end: date) -> str:
    return start.strftime("%d %b %Y") if start == end else f"{start:%d %b %Y} to {end:%d %b %Y}"


def revenue_performance(revenue: Decimal, target: Decimal, start: date, end: date) -> NotificationDraft:
    """Always yields a draft: revenue is either at/above target (good news) or below it (warning)."""
    period = _period_label(start, end)
    key = f"revenue:{start.isoformat()}:{end.isoformat()}"
    if revenue >= target:
        title, priority = "Revenue Target Achieved", "medium"
        message = f"Revenue of {format_inr(revenue)} for {period} reached the target of {format_inr(target)}."
    else:
        ratio = revenue / target
        priority = "critical" if ratio < Decimal("0.5") else "high" if ratio < Decimal("0.8") else "medium"
        title = "Revenue Below Target"
        message = f"Revenue of {format_inr(revenue)} for {period} is below the target of {format_inr(target)}."
    return NotificationDraft(
        title=title,
        message=message,
        type="revenue",
        priority=priority,
        audience=Permission.VIEW_PERFORMANCE_ALERTS,
        dedupe_key=key,
    )


def low_sales(completed: int, threshold: int, start: date, end: date) -> NotificationDraft | None:
    if completed >= threshold:
        return None
    period = _period_label(start, end)
    priority = "critical" if completed == 0 else "high" if completed * 2 < threshold else "medium"
    return NotificationDraft(
        title="Low Sales Alert",
        message=f"Only {completed} completed order(s) for {period}; the minimum expected is {threshold}.",
        type="sales",
        priority=priority,
        audience=Permission.VIEW_PERFORMANCE_ALERTS,
        dedupe_key=f"low-sales:{start.isoformat()}:{end.isoformat()}",
    )


def system_event(title: str, message: str, event_key: str, priority: str = "medium") -> NotificationDraft:
    """`event_key` must be unique per occurrence (for example 'user-created:42')."""
    return NotificationDraft(
        title=title,
        message=message,
        type="system",
        priority=priority,
        audience=Permission.VIEW_SYSTEM_ALERTS,
        dedupe_key=f"system:{event_key}",
    )