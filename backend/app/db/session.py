"""Engine and session management.

* One Engine (connection pool) is created at import time. Creating it does NOT connect,
  so the API still starts when PostgreSQL is down; requests then fail with a clean 503
  (see main.py) instead of the whole process crashing.
* `get_db` is a FastAPI dependency: one Session per request, always closed afterwards.
"""

from collections.abc import Iterator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()
_url = settings.database_url.get_secret_value()


def _engine_options(url: str) -> dict[str, Any]:
    if url.startswith("sqlite"):  # used only by the automated tests
        return {"connect_args": {"check_same_thread": False}}
    return {
        "pool_pre_ping": True,  # drop dead connections instead of failing on them
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 10,  # seconds to wait for a free connection
        "connect_args": {
            "connect_timeout": 5,  # fail fast when the server is unreachable
            "options": "-c timezone=UTC",  # all timestamps and date bucketing in UTC
        },
    }


engine = create_engine(_url, echo=settings.db_echo, **_engine_options(_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session