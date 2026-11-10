import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import type { NotificationPriority } from '@/types/notifications';
import { PRIORITY_META } from './notificationMeta';

/** Coloured pill. The label is always text, so priority never depends on colour alone. */
export function PriorityBadge({ priority }: { priority: NotificationPriority }): React.JSX.Element {
  const meta = PRIORITY_META[priority];
  return (
    <View style={[styles.pill, { backgroundColor: meta.soft }]} accessibilityLabel={`${meta.label} priority`}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
});