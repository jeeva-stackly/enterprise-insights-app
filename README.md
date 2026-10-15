# Enterprise Business Insights – Mobile App

React Native (Expo, TypeScript) frontend + FastAPI backend + PostgreSQL.

| Task | Scope |
|------|-------|
| 1 | Expo project, bottom navigation, dashboard UI |
| 2 | FastAPI backend, `GET /api/dashboard`, API service layer, loading / error / retry / refresh states |
| 3 | PostgreSQL, SQLAlchemy models, Alembic migrations, seed script, database-driven endpoints |

```
enterprise-insights-app/
├── App.tsx, src/                 React Native app (no database code; talks to the API only)
└── backend/
    ├── app/
    │   ├── main.py               app, CORS, routers, database error handlers, health checks
    │   ├── core/config.py        settings from environment variables / .env
    │   ├── db/                   base.py (declarative Base), session.py (engine + get_db)
    │   ├── models/               SQLAlchemy models  = database tables
    │   ├── schemas/              Pydantic schemas   = API request/response shapes
    │   ├── repositories/         all SQL queries (filters, aggregates, pagination)
    │   ├── services/             business rules (KPI formulas, mapping to schemas)
    │   ├── routers/              HTTP layer only
    │   └── utils/                dates, formatting
    ├── alembic/                  migrations (versions/0001_initial_schema.py)
    ├── scripts/seed_data.py      repeatable sample data
    ├── tests/                    pytest (runs on in-memory SQLite, never touches your PostgreSQL)
    ├── .env.example, alembic.ini, requirements.txt
```

---

## 1. Setup

### PostgreSQL
1. Install PostgreSQL 16 (remember the `postgres` user's password) and open **pgAdmin 4**.
2. Create a database named `insights_db` (Servers → PostgreSQL → Databases → right-click → Create → Database).

### Backend (Windows PowerShell)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env      # then edit .env: put your real password in DATABASE_URL
alembic upgrade head        # creates all tables (migration 0001)
python -m scripts.seed_data # inserts sample data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Open http://localhost:8000/docs (Swagger) and http://localhost:8000/health/db (should say `connected`).

`.env` holds the credentials and is git-ignored. Only `.env.example` (placeholder password) is committed.
If your password contains special characters (`@ : / # %`), URL-encode them in `DATABASE_URL` (`@` → `%40`).

### Frontend
```bash
npm install
npx expo start        # Expo Go on a phone on the same Wi-Fi
```
The app finds the backend automatically; override with `EXPO_PUBLIC_API_URL` in the project-root `.env` if needed.

### Tests
```powershell
cd backend
pytest
```

---

## 2. Database schema

```
categories 1───< products 1───< orders >───1 customers

activities  (polymorphic reference: reference_type + reference_id → order / customer / product)
```

| Table | Columns (type) | Keys & constraints |
|-------|----------------|--------------------|
| `customers` | id, name, email, registered_at (date), status | PK id; **UNIQUE** email; CHECK status ∈ active, inactive |
| `categories` | id, name | PK id; **UNIQUE** name |
| `products` | id, name, category_id, unit_price, unit_cost (numeric 12,2), status | PK id; UNIQUE name; **FK** category_id → categories (RESTRICT); CHECK price ≥ 0, cost ≥ 0, status ∈ active, discontinued |
| `orders` | id, order_number, customer_id, product_id, ordered_at (timestamptz), quantity, total_amount (numeric 12,2), status | PK id; UNIQUE order_number; **FK** customer_id, product_id (RESTRICT); CHECK quantity > 0, total_amount ≥ 0, status ∈ completed, pending, cancelled; indexes on ordered_at, status, customer_id, product_id |
| `activities` | id, activity_type, description, reference_type, reference_id, created_at (timestamptz) | PK id; CHECK type ∈ order, target, customer, payment, alert; CHECK reference_type and reference_id are both set or both null; index on created_at |

Design notes
* **No duplicated data:** an order stores `product_id`, and the category is reached through the product (orders never copy the category name or customer name).
* **`orders.total_amount` is stored** (not computed from today's product price) because it is the historical price paid; changing a product price later must not rewrite past revenue.
* **`products.unit_cost`** is the cost data that makes profit calculable.
* **Money** uses `NUMERIC(12,2)` (exact), never float.
* **Statuses are `VARCHAR` + CHECK** instead of PostgreSQL ENUM types, so adding a status later is a simple migration.
* `activities.reference_*` is a polymorphic pointer, intentionally not a foreign key because it can refer to different tables.
* Constraint and index names follow a naming convention (`db/base.py`), which keeps Alembic migrations predictable.

---

## 3. KPI definitions (business rules)

**Reporting period:** the last **30 calendar days including today (UTC)**, set by `KPI_PERIOD_DAYS`. The *change %* compares it with the previous 30 days.

| KPI | Definition |
|-----|-----------|
| **Revenue** | `SUM(total_amount)` of orders with status `completed` in the period |
| **Profit** | `Revenue − Cost`, where `Cost = SUM(quantity × product.unit_cost)` of the same completed orders |
| **Orders** | Number of orders in the period that are `completed` or `pending` (cancelled orders do not qualify) |
| **Customers** | Number of **distinct customers** with at least one non-cancelled order in the period |
| **Change %** | `(current − previous) / previous × 100`, rounded to 1 decimal; `0` when the previous period has no data |
| **Orders summary** | Counts by status (`completed`, `pending`, `cancelled`) in the period; `totalOrders` is all three; average order value = revenue ÷ completed orders |
| **Revenue trend** | Completed revenue per day for the last **7 days** (days with no orders are filled with 0) |
| **Top category** | Category with the highest completed revenue in the period; `sharePercent` = its revenue ÷ total revenue; change is vs the previous period |
| **Recent activities** | Latest 5 rows of `activities`, newest first; for order-related events the amount is joined from `orders` |
| **Unread notifications** | Number of `alert` activities in the last 7 days |

Revenue and profit are different numbers: profit subtracts the stored product cost.

---

## 4. API

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | KPIs, analytics preview, recent activities (same JSON contract as Task 2, now from PostgreSQL) |
| `GET /api/orders?limit=20&offset=0&status=` | Paginated orders, newest first |
| `GET /api/customers?limit=20&offset=0&status=` | Paginated customers |
| `GET /api/activities?limit=10&offset=0` | Paginated activities, newest first |
| `GET /api/analytics/revenue-trend?start_date=2026-10-01&end_date=2026-10-12` | Daily completed revenue; defaults to the last 7 days |
| `GET /health`, `GET /health/db` | Liveness, and readiness (`SELECT 1`) |

Paginated lists return `{ "items": [...], "total": n, "limit": n, "offset": n }`. `limit` is 1–100, `offset` ≥ 0; invalid values return **422**. An empty result is a normal **200** with `items: []`.

Revenue-trend validation: dates must be `YYYY-MM-DD`; `start_date` must not be after `end_date`; the range may not exceed 366 days (all **422**). If only one date is given the other is filled in. Every day in the range is returned (zero-filled), so the response shape is identical even when nothing matches.

---

## 5. How it works (answers to the review questions)

**Database session per request.** `db/session.py` creates one SQLAlchemy `Engine` (a connection pool) and a `sessionmaker`. `get_db` is a FastAPI dependency: each request gets its own `Session` and it is closed when the request ends. Routers receive it with `Depends(get_db)` and pass it down to services and repositories.

**Models vs schemas.** SQLAlchemy models (`app/models`) describe *storage*: tables, keys, constraints. Pydantic schemas (`app/schemas`) describe the *API contract*: which fields are exposed, camelCase names, validation. They change for different reasons (a column rename should not break the mobile app, and an API change should not need a migration), and schemas expose only what the client needs (for example orders return `customerName` and `category`, not internal foreign keys).

**Revenue and profit.** See section 3. Both are computed by SQL aggregates (`SUM(CASE WHEN status='completed' ...)`) joined to `products` for cost; no values are hardcoded.

**No duplicate seed data.** Each record has a natural unique key (email, order_number, product name, category name, activity type + description) and is inserted only if missing. The random generator uses a fixed seed, so the same order number always maps to the same data. `python -m scripts.seed_data --reset` wipes and rebuilds with fresh dates (order dates are relative to today).

**Pagination and date filters in the database.** `LIMIT/OFFSET`, the status filter, and the date range are part of the SQL `WHERE`/`LIMIT` clauses; totals use `COUNT(*)`. Revenue per day uses `GROUP BY` on the order date. Nothing is loaded and filtered in Python (the only Python step is filling empty days with zero).

**When PostgreSQL is unavailable.** The API still starts (engine creation does not connect). A request that cannot reach the database fails fast (5 s connect timeout) and returns **503** `{"detail": "The database is temporarily unavailable..."}`. Other database errors return **500** `{"detail": "A database error occurred."}`. Credentials, SQL and stack traces are never sent to the client; the server logs only the exception class name. The mobile app shows its existing error screen with **Retry**.

**Schema changes with Alembic.** The schema lives in migration files, not in startup code. `alembic upgrade head` applies pending migrations to an existing database. To change the schema: edit the model, run `alembic revision --autogenerate -m "describe change"`, review the generated file, then `alembic upgrade head`. `alembic downgrade -1` reverts one step. The current version is stored in the `alembic_version` table.

### Alembic commands
```powershell
alembic current                                   # which revision the database is at
alembic upgrade head                              # apply all migrations
alembic revision --autogenerate -m "add column"   # create a new migration after editing a model
alembic downgrade -1                              # undo the last migration
```

---

## 6. Frontend integration

No UI changes were needed. The React Native app still calls only `GET /api/dashboard` through `src/services` (Task 2); all database access happens in FastAPI. Loading, error, retry and pull-to-refresh behave as before. The API response contract was preserved, so `src/types/api.ts` is unchanged.

What changed in the numbers: KPI cards now show the 30-day window described in section 3, and the chart shows the last 7 days, so the chart total is no longer equal to the Revenue KPI.

---

## 7. Screenshots

**PostgreSQL tables with sample records**



![Orders table]




![Customers table]



**Swagger – `GET /api/dashboard`**



![Swagger dashboard]



## Known limitations
* Single-product orders (one product per order row); a multi-item cart would add an `order_items` table.
* No authentication; the user name/role come from settings (`DEFAULT_USER_*`).
* CORS is open (`*`) for development.
* Tests use SQLite; PostgreSQL-specific behaviour is covered by running the app against PostgreSQL.
