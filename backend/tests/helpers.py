"""Small helpers shared by the test files (kept out of conftest.py so tests can import them)."""

from app.core.security import hash_password
from app.models import User

TEST_PASSWORD = "Correct-Horse-9"


def make_user(db, email, role="viewer", status="active", name="Test User", password=TEST_PASSWORD):
    user = User(full_name=name, email=email, password_hash=hash_password(password), role=role, status=status)
    db.add(user)
    db.commit()
    return user