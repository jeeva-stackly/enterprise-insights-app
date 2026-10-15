import type { DashboardData } from '@/types/api';
import { apiGet } from './apiClient';

/**
 * Calls GET /api/dashboard and returns the typed response.
 * This is the only place the dashboard endpoint path appears; screens and
 * components never call fetch() themselves.
 */
export function getDashboardData(signal?: AbortSignal): Promise<DashboardData> {
  return apiGet<DashboardData>('/api/dashboard', signal);
}