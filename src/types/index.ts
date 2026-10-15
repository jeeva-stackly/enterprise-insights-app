export type TrendDirection = 'up' | 'down';

export type KpiId = 'revenue' | 'orders' | 'customers' | 'profit';

export type KpiIconName = 'cash-outline' | 'receipt-outline' | 'people-outline' | 'trending-up-outline';

export interface Kpi {
  id: KpiId;
  label: string;
  value: number;
  format: 'currency' | 'number';
  changePercent: number;
  icon: KpiIconName;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface RevenueTrend {
  periodLabel: string;
  points: TrendPoint[];
}

export interface SalesSummary {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

export interface TopCategory {
  name: string;
  revenue: number;
  sharePercent: number;
  changePercent: number;
}

export type ActivityType = 'order' | 'target' | 'customer' | 'alert' | 'payment';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  detail?: string;
  timeAgo: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  unreadNotifications: number;
}

export interface DashboardViewModel {
  user: UserProfile;
  kpis: Kpi[];
  revenueTrend: RevenueTrend;
  salesSummary: SalesSummary;
  topCategory: TopCategory;
  recentActivity: Activity[];
}