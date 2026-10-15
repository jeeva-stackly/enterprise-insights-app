import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/common/Card';
import { TrendBadge } from '@/components/common/TrendBadge';
import { colors, radius, spacing, typography } from '@/theme';
import type { TopCategory } from '@/types';
import { formatCurrency } from '@/utils/format';

interface TopCategoryCardProps {
  category: TopCategory;
}

export function TopCategoryCard({ category }: TopCategoryCardProps): React.JSX.Element {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="trophy-outline" size={22} color={colors.warning} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.caption}>Top performing category</Text>
          <Text style={styles.name} numberOfLines={1}>
            {category.name}
          </Text>
        </View>
        <TrendBadge changePercent={category.changePercent} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.revenue}>{formatCurrency(category.revenue)}</Text>
        <Text style={styles.share}>{category.sharePercent.toFixed(1)}% of total revenue</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(category.sharePercent, 100)}%` }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  caption: { ...typography.caption, color: colors.textSecondary },
  name: { ...typography.heading, color: colors.textPrimary },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  revenue: { ...typography.kpiValue, color: colors.textPrimary },
  share: { ...typography.caption, color: colors.textSecondary },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.warning, borderRadius: radius.pill },
});