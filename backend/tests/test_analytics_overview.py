"""Tests for GET /api/analytics/overview using a small, hand-made dataset.

The seeded sample data is wiped first so every expected number can be checked by hand.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, select

from app.models import Customer, Order, Product


def _dt(day: str, hour: int = 12, minute: int = 0, second: int = 0) -> datetime:
    y, m, d = (int(x) for x in day.split("-"))
    return datetime(y, m, d, hour, minute, second, tzinfo=timezone.utc)


@pytest.fixture()
def data(db_session):
    """Current range 2026-03-10..2026-03-12, previous range 2026-03-07..2026-03-09."""
    db = db_session
    db.execute(delete(Order))
    customers = db.scalars(select(Customer).order_by(Customer.id)).all()[:4]
    products = db.scalars(select(Product).order_by(Product.id)).all()
    prod_a = products[0]
    prod_b = next(p for p in products if p.category_id != prod_a.category_id)
    c1, c2, c3, c4 = customers

    rows = [
        # (number, customer, product, when, qty, amount, status)
        ("T1", c1, prod_a, _dt("2026-03-10", 10, 30), 2, 200, "completed"),
        ("T2", c2, prod_a, _dt("2026-03-10", 10, 45), 1, 100, "completed"),
        ("T3", c1, prod_b, _dt("2026-03-11", 15), 1, 50, "pending"),
        ("T4", c3, prod_b, _dt("2026-03-12", 9), 1, 70, "cancelled"),
        ("T5", c1, prod_b, _dt("2026-03-12", 23, 59, 59), 1, 400, "completed"),
        # outside the range: exactly midnight AFTER the end date must be excluded
        ("T6", c4, prod_a, _dt("2026-03-13", 0), 1, 999, "completed"),
        # previous period (one second before the start of the current range is still previous)
        ("T7", c2, prod_a, _dt("2026-03-09", 23, 59, 59), 1, 100, "completed"),
        ("T8", c4, prod_a, _dt("2026-03-08", 8), 1, 100, "completed"),
    ]
    for number, cust, prod, when, qty, amount, status in rows:
        db.add(
            Order(
                order_number=number,
                customer_id=cust.id,
                product_id=prod.id,
                ordered_at=when,
                quantity=qty,
                total_amount=amount,
                status=status,
            )
        )
    db.commit()
    return {"a": prod_a, "b": prod_b}


URL = "/api/analytics/overview"


def _get(client, start="2026-03-10", end="2026-03-12", **extra):
    return client.get(URL, params={"start_date": start, "end_date": end, **extra})


def test_overview_numbers_for_custom_range(client, data):
    body = _get(client).json()
    m = body["metrics"]

    assert m["revenue"]["current"] == 700  # 200 + 100 + 400 (T6 is outside, pending/cancelled excluded)
    assert m["revenue"]["previous"] == 200  # T7 + T8
    assert m["revenue"]["changePercent"] == 250.0
    assert m["revenue"]["direction"] == "up"

    assert m["orders"]["current"] == 4  # 3 completed + 1 pending, cancelled excluded
    assert m["orders"]["previous"] == 2
    assert m["customers"]["current"] == 2  # c1 and c2; c3 only has a cancelled order
    assert m["customers"]["previous"] == 2

    cost = 3 * float(data["a"].unit_cost) + 1 * float(data["b"].unit_cost)
    assert m["profit"]["current"] == pytest.approx(700 - cost)
    assert m["averageOrderValue"]["current"] == pytest.approx(700 / 3, abs=0.01)


def test_range_metadata_and_previous_period(client, data):
    r = _get(client).json()["range"]
    assert (r["startDate"], r["endDate"], r["days"]) == ("2026-03-10", "2026-03-12", 3)
    assert (r["previousStartDate"], r["previousEndDate"]) == ("2026-03-07", "2026-03-09")
    assert r["comparisonPeriod"] == "previous_period"
    assert r["granularity"] == "day"


def test_status_breakdown(client, data):
    body = _get(client).json()
    by_status = {s["status"]: s for s in body["statusBreakdown"]}
    assert [s["status"] for s in body["statusBreakdown"]] == ["completed", "pending", "cancelled"]
    assert (by_status["completed"]["count"], by_status["pending"]["count"], by_status["cancelled"]["count"]) == (3, 1, 1)
    assert by_status["completed"]["percent"] == 60.0
    assert by_status["pending"]["percent"] == 20.0
    assert body["totalOrders"] == 5
    assert body["isEmpty"] is False


def test_top_category_and_null_change_when_previous_is_zero(client, data):
    top = _get(client).json()["topCategory"]
    assert top["name"] == data["b"].category.name  # 400 beats 300
    assert top["revenue"] == 400
    assert top["sharePercent"] == pytest.approx(57.1, abs=0.1)
    assert top["previousRevenue"] == 0
    assert top["changePercent"] is None  # previous = 0, no divide-by-zero
    assert top["direction"] == "up"


def test_daily_trend_is_zero_filled_and_ordered(client, data):
    trend = _get(client).json()["trend"]
    assert [p["bucket"] for p in trend] == ["2026-03-10", "2026-03-11", "2026-03-12"]
    assert [p["revenue"] for p in trend] == [300, 0, 400]  # pending/cancelled add nothing
    assert [p["orders"] for p in trend] == [2, 0, 1]


def test_single_day_returns_24_hourly_points(client, data):
    body = _get(client, "2026-03-10", "2026-03-10").json()
    assert body["range"]["granularity"] == "hour"
    trend = body["trend"]
    assert len(trend) == 24
    assert trend[0]["bucket"] == "00:00" and trend[23]["bucket"] == "23:00"
    assert trend[10]["revenue"] == 300 and trend[10]["orders"] == 2
    assert sum(p["revenue"] for p in trend) == body["metrics"]["revenue"]["current"]


def test_empty_range_is_a_normal_response(client, data):
    body = _get(client, "2025-01-01", "2025-01-03").json()
    assert body["isEmpty"] is True
    assert body["totalOrders"] == 0
    assert body["topCategory"] is None
    assert len(body["trend"]) == 3 and all(p["revenue"] == 0 for p in body["trend"])
    assert all(s["count"] == 0 and s["percent"] == 0 for s in body["statusBreakdown"])
    for metric in body["metrics"].values():
        assert metric["current"] == 0 and metric["previous"] == 0
        assert metric["changePercent"] is None and metric["direction"] == "flat"


def test_change_percent_values(client, data):
    # 2026-03-07..03-09 has revenue 200; the 3 days before it have none
    body = _get(client, "2026-03-07", "2026-03-09").json()
    assert body["metrics"]["revenue"]["current"] == 200
    assert body["metrics"]["revenue"]["previous"] == 0
    assert body["metrics"]["revenue"]["changePercent"] is None
    body = _get(client, "2026-03-13", "2026-03-15").json()  # 999 now, 700 before
    assert body["metrics"]["revenue"]["changePercent"] == 42.7
    body = _get(client, "2026-03-10", "2026-03-10").json()  # 300 today vs 100 on 03-09
    assert body["metrics"]["revenue"]["previous"] == 100
    assert body["metrics"]["revenue"]["changePercent"] == 200.0


def test_previous_year_comparison(client, data):
    body = _get(client, comparison_period="previous_year").json()
    assert body["range"]["comparisonPeriod"] == "previous_year"
    assert body["range"]["previousStartDate"] == "2025-03-10"
    assert body["metrics"]["revenue"]["previous"] == 0
    assert body["metrics"]["revenue"]["changePercent"] is None


@pytest.mark.parametrize(
    "params",
    [
        {"start_date": "2026-03-12", "end_date": "2026-03-10"},  # start after end
        {"start_date": "2026-13-01", "end_date": "2026-03-10"},  # impossible date
        {"start_date": "not-a-date", "end_date": "2026-03-10"},
        {"start_date": "2024-01-01", "end_date": "2026-03-10"},  # longer than 366 days
        {"start_date": "2026-03-10", "end_date": "2026-03-12", "comparison_period": "last_week"},
    ],
)
def test_invalid_input_returns_422(client, data, params):
    assert client.get(URL, params=params).status_code == 422


def test_defaults_to_last_7_days(client, data):
    body = client.get(URL).json()
    assert body["range"]["days"] == 7 and len(body["trend"]) == 7