"""Pydantic response models for GET /api/dashboard.

Python fields are snake_case; the JSON sent to the app is camelCase (via the alias
generator) so it matches the TypeScript interfaces in src/types/api.ts exactly.
"""

from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel


# ---------- User ----------
class UserProfile(ApiModel):
    id: str
    name: str
    role: str
    unread_notifications: int = Field(ge=0)


# ---------- KPIs ----------
class KpiData(ApiModel):
    value: float
    change: float = Field(description="Percentage change vs the previous period (can be negative).")


class Kpis(ApiModel):
    revenue: KpiData
    orders: KpiData
    customers: KpiData
    profit: KpiData


# ---------- Analytics ----------
class TrendPoint(ApiModel):
    label: str
    value: float = Field(ge=0)


class RevenueTrend(ApiModel):
    period_label: str
    points: list[TrendPoint]


class OrdersSummary(ApiModel):
    total_orders: int = Field(ge=0)
    completed_orders: int = Field(ge=0)
    pending_orders: int = Field(ge=0)
    cancelled_orders: int = Field(ge=0)
    average_order_value: float = Field(ge=0)


class TopCategory(ApiModel):
    name: str
    revenue: float = Field(ge=0)
    share_percent: float = Field(ge=0, le=100)
    change: float


class Analytics(ApiModel):
    revenue_trend: RevenueTrend
    orders_summary: OrdersSummary
    top_category: TopCategory


# ---------- Recent activity ----------
ActivityType = Literal["order", "target", "customer", "payment", "alert"]


class RecentActivity(ApiModel):
    id: str
    type: ActivityType
    title: str
    subtitle: str
    detail: str | None = None
    time_ago: str


# ---------- Complete response ----------
class DashboardResponse(ApiModel):
    user: UserProfile
    kpis: Kpis
    analytics: Analytics
    recent_activities: list[RecentActivity]