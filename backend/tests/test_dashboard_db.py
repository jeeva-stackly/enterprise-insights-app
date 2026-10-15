from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app
from app.models import Activity, Category, Customer, Order, Product
from app.schemas.dashboard import DashboardResponse
from app.utils.dates import as_utc, day_start, utc_today
from scripts.seed_data import seed


def _completed_in_last_days(db, days):
    today = utc_today()
    start, end = day_start(today - timedelta(days=days - 1)), day_start(today + timedelta(days=1))
    orders = db.scalars(select(Order)).all()
    return [o for o in orders if start <= as_utc(o.ordered_at) < end]


# --------------------------------------------------------------------------- dashboard
def test_dashboard_payload_is_valid_and_camel_case(client):
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    body = response.json()
    DashboardResponse.model_validate(body)
    assert set(body["kpis"]) == {"revenue", "orders", "customers", "profit"}
    assert {"revenueTrend", "ordersSummary", "topCategory"} <= set(body["analytics"])
    assert len(body["recentActivities"]) == 5
    assert len(body["analytics"]["revenueTrend"]["points"]) == 7


def test_kpis_match_independent_python_calculation(client, db_session):
    body = client.get("/api/dashboard").json()
    orders = _completed_in_last_days(db_session, 30)
    completed = [o for o in orders if o.status == "completed"]

    revenue = sum(float(o.total_amount) for o in completed)
    cost = sum(o.quantity * float(o.product.unit_cost) for o in completed)
    qualifying = [o for o in orders if o.status != "cancelled"]

    assert body["kpis"]["revenue"]["value"] == pytest.approx(revenue)
    assert body["kpis"]["profit"]["value"] == pytest.approx(revenue - cost)
    assert body["kpis"]["profit"]["value"] < body["kpis"]["revenue"]["value"]  # profit != revenue
    assert body["kpis"]["orders"]["value"] == len(qualifying)
    assert body["kpis"]["customers"]["value"] == len({o.customer_id for o in qualifying})


def test_orders_summary_matches_database_counts(client, db_session):
    summary = client.get("/api/dashboard").json()["analytics"]["ordersSummary"]
    orders = _completed_in_last_days(db_session, 30)
    for status in ("completed", "pending", "cancelled"):
        assert summary[f"{status}Orders"] == sum(1 for o in orders if o.status == status)
    assert summary["totalOrders"] == len(orders)


def test_top_category_is_highest_completed_revenue(client, db_session):
    top = client.get("/api/dashboard").json()["analytics"]["topCategory"]
    totals: dict[str, float] = {}
    for o in _completed_in_last_days(db_session, 30):
        if o.status == "completed":
            totals[o.product.category.name] = totals.get(o.product.category.name, 0) + float(o.total_amount)
    best = max(totals, key=totals.get)
    assert top["name"] == best
    assert top["revenue"] == pytest.approx(totals[best])


def test_recent_activities_newest_first_and_order_amount_joined(client):
    activities = client.get("/api/dashboard").json()["recentActivities"]
    assert activities[0]["type"] == "order"
    assert activities[0]["detail"].startswith("₹")
    assert activities[0]["title"] == "New order received"


def test_empty_database_still_returns_valid_dashboard(client, db_session):
    for model in (Activity, Order, Product, Category, Customer):
        db_session.query(model).delete()
    db_session.commit()

    body = client.get("/api/dashboard").json()
    DashboardResponse.model_validate(body)
    assert body["kpis"]["revenue"]["value"] == 0
    assert body["analytics"]["topCategory"]["name"] == "No sales yet"
    assert body["recentActivities"] == []


# --------------------------------------------------------------------------- pagination
def test_orders_pagination_has_no_overlap_and_correct_total(client, db_session):
    total = db_session.scalar(select(func.count()).select_from(Order))
    first = client.get("/api/orders?limit=10&offset=0").json()
    second = client.get("/api/orders?limit=10&offset=10").json()

    assert first["total"] == second["total"] == total
    assert len(first["items"]) == 10
    ids = [o["id"] for o in first["items"]] + [o["id"] for o in second["items"]]
    assert len(ids) == len(set(ids))
    dates = [o["orderedAt"] for o in first["items"]]
    assert dates == sorted(dates, reverse=True)


def test_orders_status_filter(client):
    body = client.get("/api/orders?status=cancelled&limit=100").json()
    assert body["total"] > 0
    assert all(o["status"] == "cancelled" for o in body["items"])


def test_offset_beyond_total_returns_empty_page(client):
    body = client.get("/api/orders?offset=100000").json()
    assert body["items"] == [] and body["total"] > 0


@pytest.mark.parametrize(
    "url",
    [
        "/api/orders?limit=0",
        "/api/orders?limit=101",
        "/api/orders?offset=-1",
        "/api/orders?limit=abc",
        "/api/orders?status=unknown",
        "/api/customers?limit=0",
        "/api/activities?limit=1000",
    ],
)
def test_invalid_pagination_parameters_return_422(client, url):
    assert client.get(url).status_code == 422


def test_customers_and_activities_endpoints(client):
    customers = client.get("/api/customers?limit=5").json()
    assert customers["limit"] == 5 and len(customers["items"]) == 5 and customers["total"] >= 20
    assert {"id", "name", "email", "registeredAt", "status"} == set(customers["items"][0])

    activities = client.get("/api/activities?limit=3").json()
    assert len(activities["items"]) == 3
    stamps = [a["createdAt"] for a in activities["items"]]
    assert stamps == sorted(stamps, reverse=True)


# --------------------------------------------------------------------------- date filtering
def test_revenue_trend_filters_by_date_and_matches_database(client, db_session):
    today = utc_today()
    start, end = today - timedelta(days=9), today - timedelta(days=3)
    body = client.get(f"/api/analytics/revenue-trend?start_date={start}&end_date={end}").json()

    assert len(body["points"]) == 7
    assert body["points"][0]["date"] == str(start) and body["points"][-1]["date"] == str(end)

    expected = sum(
        float(o.total_amount)
        for o in db_session.scalars(select(Order)).all()
        if o.status == "completed" and start <= as_utc(o.ordered_at).date() <= end
    )
    assert body["totalRevenue"] == pytest.approx(expected)
    assert body["totalRevenue"] == pytest.approx(sum(p["revenue"] for p in body["points"]))


def test_revenue_trend_defaults_to_last_seven_days(client):
    body = client.get("/api/analytics/revenue-trend").json()
    assert len(body["points"]) == 7 and body["endDate"] == str(utc_today())


def test_revenue_trend_with_no_matching_orders_keeps_same_shape(client):
    body = client.get("/api/analytics/revenue-trend?start_date=2000-01-01&end_date=2000-01-05").json()
    assert body["totalRevenue"] == 0
    assert [p["revenue"] for p in body["points"]] == [0] * 5
    assert set(body) == {"startDate", "endDate", "totalRevenue", "points"}


@pytest.mark.parametrize(
    "query",
    [
        "start_date=2026-10-12&end_date=2026-10-01",  # start after end
        "start_date=not-a-date",
        "start_date=2026-13-45&end_date=2026-10-01",
        "start_date=2020-01-01&end_date=2026-10-01",  # longer than 366 days
    ],
)
def test_revenue_trend_invalid_inputs_return_422(client, query):
    response = client.get(f"/api/analytics/revenue-trend?{query}")
    assert response.status_code == 422


# --------------------------------------------------------------------------- seeding
def test_seed_is_idempotent(db_session):
    def counts():
        return [db_session.scalar(select(func.count()).select_from(m)) for m in (Category, Product, Customer, Order, Activity)]

    before = counts()
    assert all(c > 0 for c in before)
    inserted = seed(db_session)
    assert counts() == before
    assert not any(inserted.values())


# --------------------------------------------------------------------------- database errors
def test_database_down_returns_503_without_leaking_details(client):
    def broken_db():
        raise OperationalError("SELECT 1", {}, Exception("password=hunter2 host=10.0.0.5 dbname=insights_db"))
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = broken_db
    for url in ("/api/dashboard", "/api/orders", "/health/db"):
        response = client.get(url)
        assert response.status_code == 503
        assert "hunter2" not in response.text and "10.0.0.5" not in response.text
        assert response.json() == {"detail": "The database is temporarily unavailable. Please try again shortly."}


def test_liveness_does_not_need_the_database(client):
    def broken_db():
        raise OperationalError("SELECT 1", {}, Exception("down"))
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = broken_db
    assert client.get("/health").status_code == 200