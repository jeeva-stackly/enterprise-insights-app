import type { DashboardData } from '@/types/api';
import type { DashboardViewModel, Kpi } from '@/types';

/**
 * Presentation metadata (label, icon, number format) belongs to the UI, not the API,
 * so it lives here instead of being duplicated in the backend response.
 */
const KPI_META: Record<Kpi['id'], Pick<Kpi, 'label' | 'icon' | 'format'>> = {
  revenue: { label: 'Revenue', icon: 'cash-outline', format: 'currency' },
  orders: { label: 'Orders', icon: 'receipt-outline', format: 'number' },
  customers: { label: 'Customers', icon: 'people-outline', format: 'number' },
  profit: { label: 'Profit', icon: 'trending-up-outline', format: 'currency' },
};

const KPI_ORDER: Kpi['id'][] = ['revenue', 'orders', 'customers', 'profit'];

/** Converts the API response shape into the view model the components render. */
export function toDashboardViewModel(data: DashboardData): DashboardViewModel {
  const { analytics } = data;

  return {
    user: data.user,
    kpis: KPI_ORDER.map((id) => ({
      id,
      ...KPI_META[id],
      value: data.kpis[id].value,
      changePercent: data.kpis[id].change,
    })),
    revenueTrend: analytics.revenueTrend,
    salesSummary: {
      totalOrders: analytics.ordersSummary.totalOrders,
      completedOrders: analytics.ordersSummary.completedOrders,
      pendingOrders: analytics.ordersSummary.pendingOrders,
      cancelledOrders: analytics.ordersSummary.cancelledOrders,
      averageOrderValue: analytics.ordersSummary.averageOrderValue,
    },
    topCategory: {
      name: analytics.topCategory.name,
      revenue: analytics.topCategory.revenue,
      sharePercent: analytics.topCategory.sharePercent,
      changePercent: analytics.topCategory.change,
    },
    recentActivity: data.recentActivities.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      subtitle: a.subtitle,
      detail: a.detail ?? undefined,
      timeAgo: a.timeAgo,
    })),
  };
}