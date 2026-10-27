/** Response of GET /api/analytics/overview (camelCase, exactly as the backend sends it). */

export type ComparisonPeriod = 'previous_period' | 'previous_year';
export type Direction = 'up' | 'down' | 'flat';
export type Granularity = 'hour' | 'day';
export type PeriodKey = 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

/** Inclusive calendar range, both as YYYY-MM-DD. */
export interface DateRange {
  start: string;
  end: string;
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  /** null when the previous value is 0 (a percentage of zero is undefined). */
  changePercent: number | null;
  direction: Direction;
}

export interface OverviewRange {
  startDate: string;
  endDate: string;
  days: number;
  comparisonPeriod: ComparisonPeriod;
  previousStartDate: string;
  previousEndDate: string;
  granularity: Granularity;
}

export interface OverviewMetrics {
  revenue: ComparisonMetric;
  orders: ComparisonMetric;
  profit: ComparisonMetric;
  customers: ComparisonMetric;
  averageOrderValue: ComparisonMetric;
}

export interface OverviewTrendPoint {
  /** YYYY-MM-DD for daily points, HH:00 for hourly points. */
  bucket: string;
  revenue: number;
  orders: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  percent: number;
}

export interface OverviewTopCategory {
  name: string;
  revenue: number;
  sharePercent: number;
  previousRevenue: number;
  changePercent: number | null;
  direction: Direction;
}

export interface AnalyticsOverview {
  range: OverviewRange;
  metrics: OverviewMetrics;
  trend: OverviewTrendPoint[];
  statusBreakdown: StatusBreakdownItem[];
  topCategory: OverviewTopCategory | null;
  totalOrders: number;
  isEmpty: boolean;
}