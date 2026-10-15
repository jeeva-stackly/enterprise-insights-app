import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/common/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { SalesSummary } from '@/types';
import { formatNumber, formatRupees } from '@/utils/format';

interface SalesSummaryCardProps {
  summary: SalesSummary;
}

interface Segment {
  label: string;
  count: number;
  color: string;
}

export function SalesSummaryCard({ summary }: SalesSummaryCardProps): React.JSX.Element {
  const segments: Segment[] = [
    { label: 'Completed', count: summary.completedOrders, color: colors.positive },
    { label: 'Pending', count: summary.pendingOrders, color: colors.warning },
    { label: 'Cancelled', count: summary.cancelledOrders, color: colors.negative },
  ];

  return (
    <Card>
      <Text style={styles.title}>Sales & orders summary</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total orders</Text>
          <Text style={styles.statValue}>{formatNumber(summary.totalOrders)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Avg. order value</Text>
          <Text style={styles.statValue}>{formatRupees(summary.averageOrderValue)}</Text>
        </View>
      </View>

      <View style={styles.bar} accessibilityLabel="Order status distribution">
        {segments.map((s) => (
          <View key={s.label} style={{ flex: s.count, backgroundColor: s.color }} />
        ))}
      </View>

      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>
              {s.label} · {formatNumber(s.count)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.textPrimary },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  stat: { flex: 1 },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statValue: { ...typography.kpiValue, color: colors.textPrimary, marginTop: 2 },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.lg,
    gap: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.textSecondary },
});