"""Reusable FastAPI dependencies for authentication and authorization.

    user = Depends(get_current_user)                          # any logged-in, active user
    user = Depends(require_permission(Permission.MANAGE_USERS))  # logged in AND allowed

401 = "we don't know who you are" (no/invalid/expired token). 403 = "we know you, but no".
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.permissions import Permission, has_permission
from app.core.security import TokenExpiredError, TokenError, decode_access_token
from app.db.session import get_db
from app.models import User
from app.repositories import users as users_repo

# auto_error=False so we return our own consistent 401 body (the default would be 403).
bearer_scheme = HTTPBearer(auto_error=False, description="Paste the accessToken returned by POST /api/auth/login.")


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized("Not authenticated.")
    try:
        user_id = decode_access_token(credentials.credentials)
    except TokenExpiredError:
        raise _unauthorized("Your session has expired. Please log in again.") from None
    except TokenError:
        raise _unauthorized("Invalid authentication token.") from None

    user = users_repo.get_by_id(db, user_id)
    if user is None or not user.is_active:
        # Deleted or disabled after the token was issued.
        raise _unauthorized("This account is no longer available.")
    return user


def require_permission(permission: Permission) -> Callable[..., User]:
    """Build a dependency that only lets users whose role grants `permission` through."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user.role, permission):
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        return user

    return dependency