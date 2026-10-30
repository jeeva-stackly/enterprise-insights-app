import os

# Tests run against an in-memory SQLite database, never your real PostgreSQL.
# This must be set before the app is imported.
os.environ["DATABASE_URL"] = "sqlite://"
# A throwaway secret that exists only for the test run. Never a real one.
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-not-for-production-0123456789"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"

import pytest  # noqa: E402
from argon2 import PasswordHasher  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import models  # noqa: E402,F401
from app.core import security  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from helpers import make_user  # noqa: E402
from scripts.seed_data import seed  # noqa: E402

# Cheap Argon2 settings so hashing a handful of test users is instant. Production keeps the defaults.
security._hasher = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as session:
        seed(session)
        yield session
    engine.dispose()


@pytest.fixture()
def users(db_session):
    return {
        "admin": make_user(db_session, "admin@test.com", "admin", name="Ada Admin"),
        "analyst": make_user(db_session, "analyst@test.com", "analyst", name="Ana Analyst"),
        "viewer": make_user(db_session, "viewer@test.com", "viewer", name="Vik Viewer"),
        "disabled": make_user(db_session, "disabled@test.com", "viewer", status="disabled", name="Dan Disabled"),
    }


@pytest.fixture()
def anon_client(db_session):
    """A client that sends NO token. Used by the authentication tests."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def client(anon_client, users):
    """Logged in as an Admin, so the Task 3/4 tests keep working unchanged now that login is required."""
    anon_client.headers["Authorization"] = f"Bearer {create_access_token(users['admin'].id)[0]}"
    return anon_client


@pytest.fixture()
def auth_header():
    """auth_header(user) -> {"Authorization": "Bearer <token>"} for that user."""

    def build(user):
        return {"Authorization": f"Bearer {create_access_token(user.id)[0]}"}

    return build