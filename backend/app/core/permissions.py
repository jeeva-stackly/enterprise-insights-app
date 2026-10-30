"""Role -> permission table. The single source of truth for who may do what (see README)."""

from enum import StrEnum

from app.models.constants import Role


class Permission(StrEnum):
    VIEW_DASHBOARD = "view_dashboard"
    VIEW_ANALYTICS = "view_analytics"
    VIEW_ACTIVITIES = "view_activities"
    MANAGE_USERS = "manage_users"
    CHANGE_ROLES = "change_roles"


_VIEW = frozenset({Permission.VIEW_DASHBOARD, Permission.VIEW_ANALYTICS, Permission.VIEW_ACTIVITIES})

ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    Role.ADMIN: _VIEW | {Permission.MANAGE_USERS, Permission.CHANGE_ROLES},
    Role.ANALYST: _VIEW,
    Role.VIEWER: _VIEW,
}


def has_permission(role: str, permission: Permission) -> bool:
    """Unknown roles get no permissions at all."""
    return permission in ROLE_PERMISSIONS.get(role, frozenset())