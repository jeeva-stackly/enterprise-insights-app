import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.routers import activities, analytics, customers, dashboard, orders

logger = logging.getLogger("app.db")
settings = get_settings()

app = FastAPI(title=settings.app_title, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,  # must be False when allow_origins is "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in (dashboard, orders, customers, analytics, activities):
    app.include_router(router_module.router)


# ---------------------------------------------------------------------------
# Database error handling
# Clients only ever see a generic message. The real cause is logged on the server by exception
# class name only (never the SQL, parameters or connection string, which may contain secrets).
# ---------------------------------------------------------------------------
async def _database_unavailable(_: Request, exc: Exception) -> JSONResponse:
    logger.error("Database unavailable: %s", type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is temporarily unavailable. Please try again shortly."},
    )


async def _database_error(_: Request, exc: Exception) -> JSONResponse:
    logger.error("Database query failed: %s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "A database error occurred."})


# Connection refused / server down / pool exhausted  -> 503 (retryable)
for exc_class in (OperationalError, InterfaceError, PoolTimeoutError):
    app.add_exception_handler(exc_class, _database_unavailable)
# Everything else from SQLAlchemy (bad query, constraint violation, ...) -> 500
app.add_exception_handler(SQLAlchemyError, _database_error)


@app.get("/health", tags=["Health"], summary="Liveness check (does not touch the database)")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db", tags=["Health"], summary="Readiness check (runs SELECT 1 on PostgreSQL)")
def health_db(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}