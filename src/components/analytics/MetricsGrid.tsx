import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme';
import type { ComparisonMetric, OverviewMetrics } from '@/types/analytics';
import { formatCurrency, formatNumber } from '@/utils/format';

import { ComparisonBadge } from './ComparisonBadge';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Item {
  label: string;
  icon: IconName;
  metric: ComparisonMetric;
  money: boolean;
}

export function MetricsGrid({ metrics }: { metrics: OverviewMetrics }): React.JSX.Element {
  const items: Item[] = [
    { label: 'Revenue', icon: 'cash-outline', metric: metrics.revenue, money: true },
    { label: 'Orders', icon: 'receipt-outline', metric: metrics.orders, money: false },
    { label: 'Profit', icon: 'trending-up-outline', metric: metrics.profit, money: true },
    { label: 'Customers', icon: 'people-outline', metric: metrics.customers, money: false },
  ];
  const fmt = (v: number, money: boolean): string => (money ? formatCurrency(v) : formatNumber(v));

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {items.map((i) => (
          <Card key={i.label} style={styles.cell}>
            <View style={styles.head}>
              <Ionicons name={i.icon} size={16} color={colors.primary} />
              <Text style={styles.label}>{i.label}</Text>
            </View>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(i.metric.current, i.money)}
            </Text>
            <ComparisonBadge changePercent={i.metric.changePercent} direction={i.metric.direction} />
            <Text style={styles.prev} numberOfLines={1}>
              Previous: {fmt(i.metric.previous, i.money)}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={styles.aov}>
        <View style={styles.aovText}>
          <Text style={styles.label}>Average order value</Text>
          <Text style={styles.value}>{formatCurrency(metrics.averageOrderValue.current)}</Text>
          <Text style={styles.prev}>Previous: {formatCurrency(metrics.averageOrderValue.previous)}</Text>
        </View>
        <ComparisonBadge
          changePercent={metrics.averageOrderValue.changePercent}
          direction={metrics.averageOrderValue.direction}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexBasis: '47%', flexGrow: 1, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.kpiValue, color: colors.textPrimary },
  prev: { ...typography.caption, color: colors.textMuted },
  aov: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aovText: { gap: spacing.xs },
});