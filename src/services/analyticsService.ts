import type { AnalyticsOverview, ComparisonPeriod } from '@/types/analytics';
import { apiGet } from './apiClient';

export interface OverviewParams {
  startDate: string;
  endDate: string;
  comparisonPeriod?: ComparisonPeriod;
}

/** Identical requests that are already running share one promise (no duplicate network calls). */
const inFlight = new Map<string, Promise<AnalyticsOverview>>();

/**
 * Calls GET /api/analytics/overview. This is the only place that knows the path and the
 * query-string names; screens and hooks pass plain typed values.
 */
export function getAnalyticsOverview(params: OverviewParams): Promise<AnalyticsOverview> {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
    comparison_period: params.comparisonPeriod ?? 'previous_period',
  }).toString();

  const existing = inFlight.get(query);
  if (existing) return existing;

  const request = apiGet<AnalyticsOverview>(`/api/analytics/overview?${query}`).finally(() => {
    inFlight.delete(query);
  });
  inFlight.set(query, request);
  return request;
}