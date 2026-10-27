import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/common/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { StatusBreakdownItem } from '@/types/analytics';
import { formatNumber } from '@/utils/format';

const STATUS_COLOR: Record<string, string> = {
  completed: colors.positive,
  pending: colors.warning,
  cancelled: colors.negative,
};

const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function StatusBreakdownCard({ items, total }: { items: StatusBreakdownItem[]; total: number }): React.JSX.Element {
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>Order status</Text>
        <Text style={styles.total}>{formatNumber(total)} orders</Text>
      </View>

      <View style={styles.bar} accessibilityLabel="Order status share">
        {items
          .filter((i) => i.count > 0)
          .map((i) => (
            <View key={i.status} style={{ flex: i.count, backgroundColor: STATUS_COLOR[i.status] ?? colors.primary }} />
          ))}
      </View>

      <View style={styles.list}>
        {items.map((i) => (
          <View key={i.status} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[i.status] ?? colors.primary }]} />
            <Text style={styles.name}>{titleCase(i.status)}</Text>
            <Text style={styles.count}>{formatNumber(i.count)}</Text>
            <Text style={styles.percent}>{i.percent.toFixed(1)}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.heading, color: colors.textPrimary },
  total: { ...typography.caption, color: colors.textMuted },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginTop: spacing.md,
  },
  list: { marginTop: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { ...typography.body, color: colors.textPrimary, flex: 1 },
  count: { ...typography.bodyStrong, color: colors.textPrimary },
  percent: { ...typography.caption, color: colors.textMuted, width: 48, textAlign: 'right' },
});