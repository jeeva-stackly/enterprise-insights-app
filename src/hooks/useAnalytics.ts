import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/apiClient';
import { getAnalyticsOverview } from '@/services/analyticsService';
import type { AnalyticsOverview, ComparisonPeriod, DateRange } from '@/types/analytics';

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

interface UseAnalyticsResult {
  data: AnalyticsOverview | null;
  /** True while a request for the current filter is running (first load or filter change). */
  loading: boolean;
  /** True while a pull-to-refresh request is running. */
  refreshing: boolean;
  /** True when `data` belongs to an older filter and the new one is still loading. */
  stale: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useAnalytics(range: DateRange, comparison: ComparisonPeriod = 'previous_period'): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [dataKey, setDataKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const latestRequest = useRef(0); // only the newest request may update state
  const shownKey = useRef<string | null>(null);

  const key = `${range.start}|${range.end}|${comparison}`;

  const load = useCallback(async (): Promise<void> => {
    const id = ++latestRequest.current;
    const isCurrent = (): boolean => mounted.current && id === latestRequest.current;

    try {
      const response = await getAnalyticsOverview({
        startDate: range.start,
        endDate: range.end,
        comparisonPeriod: comparison,
      });
      if (!isCurrent()) return; // a newer filter was chosen while this one was loading
      setData(response);
      setDataKey(key);
      shownKey.current = key;
      setError(null);
    } catch (e) {
      if (!isCurrent()) return;
      if (e instanceof ApiError) {
        if (__DEV__) console.warn(`[analytics] ${e.kind}: ${e.detail ?? e.message}`);
        setError(e.message);
      } else {
        if (__DEV__) console.warn('[analytics] unexpected error', e);
        setError(FALLBACK_MESSAGE);
      }
      // Never keep showing numbers that belong to a different filter than the one requested.
      if (shownKey.current !== key) {
        setData(null);
        setDataKey(null);
        shownKey.current = null;
      }
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range.start, range.end, comparison, key]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const retry = useCallback(async () => {
    setError(null);
    setLoading(true);
    await load();
  }, [load]);

  return { data, loading, refreshing, stale: data !== null && dataKey !== key, error, refresh, retry };
}