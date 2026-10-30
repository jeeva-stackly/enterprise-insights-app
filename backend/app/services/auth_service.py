from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_against_dummy, verify_password
from app.models import User
from app.repositories import users as users_repo
from app.schemas.auth import LoginResponse, UserOut
from app.services.errors import ForbiddenError, UnauthorizedError

# One message for "unknown email" and "wrong password" so the API never reveals which emails exist.
INVALID_CREDENTIALS = "Incorrect email or password."


def to_user_out(user: User) -> UserOut:
    return UserOut(id=user.id, full_name=user.full_name, email=user.email, role=user.role, status=user.status)


def login(db: Session, email: str, password: str) -> LoginResponse:
    user = users_repo.get_by_email(db, email)
    if user is None:
        verify_against_dummy(password)
        raise UnauthorizedError(INVALID_CREDENTIALS)
    if not verify_password(password, user.password_hash):
        raise UnauthorizedError(INVALID_CREDENTIALS)
    # Checked only after the password is correct, so a disabled account is not revealed to strangers.
    if not user.is_active:
        raise ForbiddenError("This account has been disabled. Please contact an administrator.")

    token, expires_in = create_access_token(user.id)
    return LoginResponse(access_token=token, expires_in=expires_in, user=to_user_out(user))