"""Password hashing (Argon2) and JWT access tokens (PyJWT).

* Passwords are hashed with Argon2id, a memory-hard algorithm. The hash string already contains
  its own random salt and parameters, so nothing else needs to be stored.
* Tokens are signed with JWT_SECRET_KEY from the environment. The algorithm is pinned when
  decoding, so a forged token that claims "alg: none" (or any other algorithm) is rejected.
* A token carries only the user id (`sub`) and its timestamps. The role is NOT put in the token:
  it is read from PostgreSQL on every request, so a demoted or disabled user loses access at once.
"""

from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()  # Argon2id with the library's recommended parameters
_dummy_hash: str | None = None


class TokenError(Exception):
    """The token is missing a claim, malformed, or has a bad signature."""


class TokenExpiredError(TokenError):
    """The token was valid but its expiry time has passed."""


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def verify_against_dummy(password: str) -> None:
    """Spend the same time as a real check, so response time does not reveal unknown emails."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = _hasher.hash("not-a-real-password")
    verify_password(password, _dummy_hash)


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> tuple[str, int]:
    """Returns (token, seconds until it expires)."""
    settings = get_settings()
    lifetime = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + lifetime}
    token = jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> int:
    """Validates signature, expiry and required claims. Returns the user id."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
        return int(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError from exc
    except (jwt.InvalidTokenError, ValueError, KeyError) as exc:
        raise TokenError from exc