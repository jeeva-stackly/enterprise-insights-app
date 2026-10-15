/**
 * Types for the FastAPI response of GET /api/dashboard.
 * They mirror backend/app/schemas/dashboard.py field for field (camelCase JSON).
 */

export interface KPIData {
  value: number;
  /** Percentage change vs previous period; negative means a decrease. */
  change: number;
}

export interface KPIs {
  revenue: KPIData;
  orders: KPIData;
  customers: KPIData;
  profit: KPIData;
}

export interface ApiUserProfile {
  id: string;
  name: string;
  role: string;
  unreadNotifications: number;
}

export interface ApiTrendPoint {
  label: string;
  value: number;
}

export interface ApiRevenueTrend {
  periodLabel: string;
  points: ApiTrendPoint[];
}

export interface ApiOrdersSummary {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

export interface ApiTopCategory {
  name: string;
  revenue: number;
  sharePercent: number;
  change: number;
}

export interface ApiAnalytics {
  revenueTrend: ApiRevenueTrend;
  ordersSummary: ApiOrdersSummary;
  topCategory: ApiTopCategory;
}

export type ApiActivityType = 'order' | 'target' | 'customer' | 'payment' | 'alert';

export interface ApiRecentActivity {
  id: string;
  type: ApiActivityType;
  title: string;
  subtitle: string;
  detail?: string | null;
  timeAgo: string;
}

/** Complete response of GET /api/dashboard. */
export interface DashboardData {
  user: ApiUserProfile;
  kpis: KPIs;
  analytics: ApiAnalytics;
  recentActivities: ApiRecentActivity[];
}