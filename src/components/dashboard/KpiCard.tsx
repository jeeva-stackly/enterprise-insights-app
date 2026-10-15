import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/common/Card';
import { TrendBadge } from '@/components/common/TrendBadge';
import { colors, radius, typography } from '@/theme';
import type { Kpi, KpiId } from '@/types';
import { formatCurrency, formatNumber } from '@/utils/format';

const ACCENTS: Record<KpiId, { fg: string; bg: string }> = {
  revenue: { fg: colors.primary, bg: colors.primarySoft },
  orders: { fg: colors.info, bg: colors.infoSoft },
  customers: { fg: colors.purple, bg: colors.purpleSoft },
  profit: { fg: colors.positive, bg: colors.positiveSoft },
};

interface KpiCardProps {
  kpi: Kpi;
  style?: StyleProp<ViewStyle>;
}

export function KpiCard({ kpi, style }: KpiCardProps): React.JSX.Element {
  const accent = ACCENTS[kpi.id];
  const value = kpi.format === 'currency' ? formatCurrency(kpi.value) : formatNumber(kpi.value);

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
          <Ionicons name={kpi.icon} size={18} color={accent.fg} />
        </View>
        <TrendBadge changePercent={kpi.changePercent} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {kpi.label}
      </Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'space-between', gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  value: { ...typography.kpiValue, color: colors.textPrimary },
});