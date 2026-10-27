import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';
import type { Direction } from '@/types/analytics';
import { formatPercent } from '@/utils/format';

interface ComparisonBadgeProps {
  changePercent: number | null;
  direction: Direction;
}

/**
 * Change vs the previous period.
 * changePercent === null means the previous value was 0, so no percentage exists:
 * show "New" (it grew from nothing) or "No change" (still nothing) instead of Infinity / NaN.
 */
export function ComparisonBadge({ changePercent, direction }: ComparisonBadgeProps): React.JSX.Element {
  let label: string;
  if (changePercent !== null) label = formatPercent(changePercent);
  else label = direction === 'up' ? 'New' : 'No change';

  const tone =
    direction === 'up'
      ? { fg: colors.positive, bg: colors.positiveSoft, icon: 'arrow-up' as const }
      : direction === 'down'
        ? { fg: colors.negative, bg: colors.negativeSoft, icon: 'arrow-down' as const }
        : { fg: colors.textSecondary, bg: colors.border, icon: 'remove' as const };

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessibilityLabel={`${direction}, ${label}`}>
      <Ionicons name={tone.icon} size={12} color={tone.fg} />
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
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
});