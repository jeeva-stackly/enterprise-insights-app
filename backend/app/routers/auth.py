from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Log in with email and password",
    description=(
        "Returns a JWT access token and the user's basic profile. 401 for wrong credentials "
        "(the same message for unknown email and wrong password), 403 for a disabled account."
    ),
)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return auth_service.login(db, body.email, body.password)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Current user",
    description="Identity comes from the bearer token only; the client cannot ask for another user.",
)
def read_me(user: User = Depends(get_current_user)) -> UserOut:
    return auth_service.to_user_out(user)