import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/apiClient';
import { toDashboardViewModel } from '@/services/dashboardMapper';
import { getDashboardData } from '@/services/dashboardService';
import type { DashboardViewModel } from '@/types';

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

interface UseDashboardResult {
  data: DashboardViewModel | null;
  /** True only for the very first load (no data on screen yet). */
  loading: boolean;
  /** True while a pull-to-refresh request is in flight. */
  refreshing: boolean;
  /** User-friendly message; never a raw backend error. */
  error: string | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await getDashboardData();
      if (!mounted.current) return;
      setData(toDashboardViewModel(response));
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError) {
        if (__DEV__) console.warn(`[dashboard] ${e.kind}: ${e.detail ?? e.message}`);
        setError(e.message);
      } else {
        if (__DEV__) console.warn('[dashboard] unexpected error', e);
        setError(FALLBACK_MESSAGE);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load().finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (mounted.current) setRefreshing(false);
  }, [load]);

  const retry = useCallback(async () => {
    setLoading(true);
    await load();
    if (mounted.current) setLoading(false);
  }, [load]);

  return { data, loading, refreshing, error, refresh, retry };
}