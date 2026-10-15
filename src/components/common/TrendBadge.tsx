import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';
import { formatPercent } from '@/utils/format';

interface TrendBadgeProps {
  changePercent: number;
}

export function TrendBadge({ changePercent }: TrendBadgeProps): React.JSX.Element {
  const isUp = changePercent >= 0;
  const fg = isUp ? colors.positive : colors.negative;
  const bg = isUp ? colors.positiveSoft : colors.negativeSoft;

  return (
    <View
      style={[styles.badge, { backgroundColor: bg }]}
      accessibilityLabel={`${isUp ? 'Up' : 'Down'} ${formatPercent(changePercent)}`}
    >
      <Ionicons name={isUp ? 'arrow-up' : 'arrow-down'} size={12} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{formatPercent(changePercent)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  text: { ...typography.caption, fontWeight: '700' },
})