"""Allowed values for status/type columns.

Stored as plain strings guarded by CHECK constraints (instead of PostgreSQL ENUM types):
adding a new status later is a simple migration, not an ALTER TYPE.
"""

ORDER_STATUSES = ("completed", "pending", "cancelled")
CUSTOMER_STATUSES = ("active", "inactive")
PRODUCT_STATUSES = ("active", "discontinued")
ACTIVITY_TYPES = ("order", "target", "customer", "payment", "alert")


def in_list(column: str, values: tuple[str, ...]) -> str:
    """Build a `column IN ('a', 'b')` SQL fragment for CheckConstraint."""
    return f"{column} IN ({', '.join(repr(v) for v in values)})"