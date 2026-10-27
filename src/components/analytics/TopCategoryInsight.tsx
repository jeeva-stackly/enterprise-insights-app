import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/common/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { OverviewTopCategory } from '@/types/analytics';
import { formatCurrency } from '@/utils/format';

import { ComparisonBadge } from './ComparisonBadge';

export function TopCategoryInsight({ category }: { category: OverviewTopCategory | null }): React.JSX.Element {
  return (
    <Card>
      <Text style={styles.title}>Top category</Text>
      {category ? (
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {category.name}
            </Text>
            <ComparisonBadge changePercent={category.changePercent} direction={category.direction} />
          </View>
          <Text style={styles.revenue}>{formatCurrency(category.revenue)}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, category.sharePercent))}%` }]} />
          </View>
          <Text style={styles.caption}>
            {category.sharePercent.toFixed(1)}% of revenue · previous {formatCurrency(category.previousRevenue)}
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>No completed sales in this period.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.textPrimary },
  body: { marginTop: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { ...typography.bodyStrong, color: colors.textPrimary, flexShrink: 1 },
  revenue: { ...typography.kpiValue, color: colors.primary },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  caption: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
});