"""The alert rules are pure functions, so they are tested with plain numbers: no database, no HTTP."""

from datetime import date
from decimal import Decimal

from app.core.permissions import Permission
from app.services import notification_rules as rules

DAY = date(2026, 10, 12)


def test_high_value_order_alert_uses_indian_rupee_format_and_high_priority():
    draft = rules.high_value_order(7, "ORD1007", Decimal("250000"), Decimal("200000"))
    assert draft is not None
    assert draft.title == "High-Value Order Received"
    assert draft.message.startswith("A new order worth ₹2,50,000 has been received")
    assert draft.priority == "high"
    assert draft.type == "order"
    assert draft.related_entity_type == "order" and draft.related_entity_id == 7
    assert draft.dedupe_key == "order-high-value:7"


def test_high_value_threshold_is_inclusive_and_below_it_there_is_no_alert():
    assert rules.high_value_order(1, "ORD1", Decimal("200000"), Decimal("200000")) is not None
    assert rules.high_value_order(1, "ORD1", Decimal("199999"), Decimal("200000")) is None


def test_revenue_above_target_is_good_news():
    draft = rules.revenue_performance(Decimal("300000"), Decimal("250000"), DAY, DAY)
    assert draft.title == "Revenue Target Achieved"
    assert draft.type == "revenue" and draft.priority == "medium"


def test_revenue_below_target_priority_grows_with_the_shortfall():
    target = Decimal("100000")
    assert rules.revenue_performance(Decimal("90000"), target, DAY, DAY).priority == "medium"
    assert rules.revenue_performance(Decimal("70000"), target, DAY, DAY).priority == "high"
    critical = rules.revenue_performance(Decimal("10000"), target, DAY, DAY)
    assert critical.priority == "critical"
    assert critical.title == "Revenue Below Target"


def test_revenue_alert_key_is_per_period_so_each_period_alerts_once():
    first = rules.revenue_performance(Decimal("1"), Decimal("10"), DAY, DAY)
    again = rules.revenue_performance(Decimal("2"), Decimal("10"), DAY, DAY)
    other_day = rules.revenue_performance(Decimal("1"), Decimal("10"), date(2026, 10, 13), date(2026, 10, 13))
    assert first.dedupe_key == again.dedupe_key
    assert first.dedupe_key != other_day.dedupe_key


def test_low_sales_alert_only_below_the_threshold():
    assert rules.low_sales(5, 5, DAY, DAY) is None
    assert rules.low_sales(4, 5, DAY, DAY).priority == "medium"
    assert rules.low_sales(2, 5, DAY, DAY).priority == "high"
    zero = rules.low_sales(0, 5, DAY, DAY)
    assert zero.priority == "critical" and zero.type == "sales"


def test_only_completed_and_cancelled_orders_raise_status_alerts():
    assert rules.order_status_changed(1, "ORD1", "pending", Decimal("10")) is None
    completed = rules.order_status_changed(1, "ORD1", "completed", Decimal("10"))
    cancelled = rules.order_status_changed(1, "ORD1", "cancelled", Decimal("10"))
    assert completed.title == "Order Completed" and completed.dedupe_key == "order-status:1:completed"
    assert cancelled.title == "Order Cancelled" and cancelled.priority == "medium"


def test_audiences_match_the_documented_visibility_rules():
    assert rules.system_event("t", "m", "k").audience == Permission.VIEW_SYSTEM_ALERTS
    assert rules.revenue_performance(Decimal(1), Decimal(2), DAY, DAY).audience == Permission.VIEW_PERFORMANCE_ALERTS
    assert rules.high_value_order(1, "O", Decimal(5), Decimal(1)).audience == Permission.VIEW_OPERATIONAL_ALERTS
    