from typing import Annotated

from pydantic import Field, StringConstraints

from app.models.constants import Role, UserStatus
from app.schemas.auth import Email
from app.schemas.base import ApiModel

FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class UserCreate(ApiModel):
    full_name: FullName
    email: Email
    password: str = Field(min_length=8, max_length=128, description="At least 8 characters.")
    role: Role = Role.VIEWER


class RoleUpdate(ApiModel):
    role: Role


class StatusUpdate(ApiModel):
    status: UserStatus