"""Allowed values for status/type columns.

Stored as plain strings guarded by CHECK constraints (instead of PostgreSQL ENUM types):
adding a new status later is a simple migration, not an ALTER TYPE.
"""

from enum import StrEnum

ORDER_STATUSES = ("completed", "pending", "cancelled")
CUSTOMER_STATUSES = ("active", "inactive")
PRODUCT_STATUSES = ("active", "discontinued")
ACTIVITY_TYPES = ("order", "target", "customer", "payment", "alert")


def in_list(column: str, values: tuple[str, ...]) -> str:
    """Build a `column IN ('a', 'b')` SQL fragment for CheckConstraint."""
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Role(StrEnum):
    """Supported user roles. Stored as plain strings (see CHECK constraint on users.role)."""

    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


USER_ROLES = tuple(r.value for r in Role)
USER_STATUSES = tuple(s.value for s in UserStatus)