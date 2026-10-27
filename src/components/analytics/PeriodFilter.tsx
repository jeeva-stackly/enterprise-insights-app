import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';
import type { PeriodKey } from '@/types/analytics';
import { PERIODS } from '@/utils/dateRange';

interface PeriodFilterProps {
  selected: PeriodKey;
  onSelect: (key: PeriodKey) => void;
}

/** Horizontally scrollable filter chips: Today / Last 7 Days / Last 30 Days / This Month / Custom. */
export function PeriodFilter({ selected, onSelect }: PeriodFilterProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {PERIODS.map((p) => {
        const active = p.key === selected;
        return (
          <Pressable
            key={p.key}
            onPress={() => onSelect(p.key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={p.label}
          >
            <Text style={[styles.text, active && styles.textActive]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...typography.bodyStrong, color: colors.textSecondary },
  textActive: { color: '#fff' },
});