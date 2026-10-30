import re
from typing import Annotated, Literal

from pydantic import AfterValidator, Field

from app.models.constants import Role, UserStatus
from app.schemas.base import ApiModel

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    """Trim, lower-case and sanity-check an email. Lower-casing makes the unique rule case-insensitive."""
    value = value.strip().lower()
    if len(value) > 255 or not _EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address.")
    return value


Email = Annotated[str, AfterValidator(normalize_email)]


class LoginRequest(ApiModel):
    email: Email
    # max_length stops someone from sending a huge string to make the hash check slow.
    password: str = Field(min_length=1, max_length=128)


class UserOut(ApiModel):
    """What the API may reveal about a user. There is deliberately no password field here."""

    id: int
    full_name: str
    email: str
    role: Role
    status: UserStatus


class LoginResponse(ApiModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Seconds until the token expires.")
    user: UserOut