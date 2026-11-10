"""Role -> permission table. The single source of truth for who may do what (see README)."""

from enum import StrEnum

from app.models.constants import Role


class Permission(StrEnum):
    VIEW_DASHBOARD = "view_dashboard"
    VIEW_ANALYTICS = "view_analytics"
    VIEW_ACTIVITIES = "view_activities"
    MANAGE_USERS = "manage_users"
    CHANGE_ROLES = "change_roles"
    # Orders and alerts (Task 6)
    MANAGE_ORDERS = "manage_orders"  # create orders, move them to completed / cancelled
    VIEW_PERFORMANCE_ALERTS = "view_performance_alerts"  # revenue and sales alerts
    VIEW_OPERATIONAL_ALERTS = "view_operational_alerts"  # order and customer alerts
    VIEW_SYSTEM_ALERTS = "view_system_alerts"  # system-level alerts
    RUN_ALERT_CHECKS = "run_alert_checks"  # trigger the revenue / low-sales checks by hand


_VIEW = frozenset({Permission.VIEW_DASHBOARD, Permission.VIEW_ANALYTICS, Permission.VIEW_ACTIVITIES})
_PERFORMANCE = frozenset({Permission.VIEW_PERFORMANCE_ALERTS})
_OPERATIONS = frozenset({Permission.MANAGE_ORDERS, Permission.VIEW_OPERATIONAL_ALERTS})

ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    Role.ADMIN: _VIEW
    | _PERFORMANCE
    | _OPERATIONS
    | {
        Permission.MANAGE_USERS,
        Permission.CHANGE_ROLES,
        Permission.VIEW_SYSTEM_ALERTS,
        Permission.RUN_ALERT_CHECKS,
    },
    Role.ANALYST: _VIEW | _PERFORMANCE | _OPERATIONS,
    Role.VIEWER: _VIEW | _PERFORMANCE,
}


def has_permission(role: str, permission: Permission) -> bool:
    """Unknown roles get no permissions at all."""
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def roles_with(permission: Permission) -> list[str]:
    """Every role that holds `permission`. Used to decide who receives a notification."""
    return [str(role) for role, granted in ROLE_PERMISSIONS.items() if permission in granted]