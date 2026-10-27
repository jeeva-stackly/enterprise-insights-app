import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalyticsTrendChart } from '@/components/analytics/AnalyticsTrendChart';
import { CustomRangePicker } from '@/components/analytics/CustomRangePicker';
import { MetricsGrid } from '@/components/analytics/MetricsGrid';
import { PeriodFilter } from '@/components/analytics/PeriodFilter';
import { StatusBreakdownCard } from '@/components/analytics/StatusBreakdownCard';
import { TopCategoryInsight } from '@/components/analytics/TopCategoryInsight';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { StatusView } from '@/components/common/StatusView';
import { useAnalytics } from '@/hooks/useAnalytics';
import { colors, spacing, typography } from '@/theme';
import type { DateRange, PeriodKey } from '@/types/analytics';
import { formatRange, rangeForPeriod, validateCustomRange } from '@/utils/dateRange';

export function AnalyticsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<PeriodKey>('last7');
  const [range, setRange] = useState<DateRange>(() => rangeForPeriod('last7'));
  const [draft, setDraft] = useState<{ start: string | null; end: string | null }>({
    start: range.start,
    end: range.end,
  });
  const [draftError, setDraftError] = useState<string | null>(null);

  const { data, loading, refreshing, stale, error, refresh, retry } = useAnalytics(range);

  const selectPeriod = useCallback((key: PeriodKey) => {
    setPeriod(key);
    setDraftError(null);
    if (key !== 'custom') setRange(rangeForPeriod(key)); // presets apply immediately
  }, []);

  const applyCustom = useCallback(() => {
    const message = validateCustomRange(draft.start, draft.end);
    setDraftError(message);
    if (!message && draft.start && draft.end) setRange({ start: draft.start, end: draft.end });
  }, [draft]);

  const header = (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        Analytics
      </Text>
      <PeriodFilter selected={period} onSelect={selectPeriod} />
      {period === 'custom' ? (
        <CustomRangePicker
          start={draft.start}
          end={draft.end}
          error={draftError}
          onChange={(next) => {
            setDraft(next);
            setDraftError(null);
          }}
          onApply={applyCustom}
        />
      ) : null}
      <Text style={styles.range}>
        {formatRange(range.start, range.end)}
        {data && !stale ? `  ·  vs ${formatRange(data.range.previousStartDate, data.range.previousEndDate)}` : ''}
      </Text>
    </View>
  );

  const content = ((): React.JSX.Element => {
    if (loading && !data) return <StatusView variant="loading" title="Loading analytics..." />;

    if (!data && error) {
      return (
        <StatusView
          variant="error"
          title="Couldn't load analytics"
          message={error}
          actionLabel="Retry"
          onActionPress={() => void retry()}
        />
      );
    }

    if (!data) {
      return <StatusView variant="empty" title="No data available" message="There is nothing to show yet." />;
    }

    if (data.isEmpty && !stale) {
      return (
        <StatusView
          variant="empty"
          icon="bar-chart-outline"
          title="No orders in this period"
          message="Try a different date range."
        />
      );
    }

    return (
      <View style={[styles.stack, stale && styles.dimmed]}>
        {error ? <ErrorBanner message={error} onRetry={() => void refresh()} /> : null}
        <MetricsGrid metrics={data.metrics} />
        <AnalyticsTrendChart
          points={data.trend}
          granularity={data.range.granularity}
          total={data.metrics.revenue.current}
        />
        <StatusBreakdownCard items={data.statusBreakdown} total={data.totalOrders} />
        <TopCategoryInsight category={data.topCategory} />
      </View>
    );
  })();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }
    >
      {header}
      <View style={styles.content}>{content}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  range: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  content: { flex: 1, marginTop: spacing.md, minHeight: 280 },
  stack: { gap: spacing.md },
  dimmed: { opacity: 0.5 },
});