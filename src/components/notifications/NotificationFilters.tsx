import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { NotificationFilters as Filters, NotificationPriority, NotificationType } from '@/types/notifications';
import { PRIORITY_META, PRIORITY_ORDER, TYPE_META, TYPE_ORDER } from './notificationMeta';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, selected, onPress }: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

/** Unread / All switch, category chips and priority chips. They only choose what to ask the server for. */
export function NotificationFilters({ filters, onChange }: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        <Pressable
          onPress={() => onChange({ unreadOnly: false })}
          style={[styles.segmentButton, !filters.unreadOnly && styles.segmentActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: !filters.unreadOnly }}
        >
          <Text style={[styles.segmentText, !filters.unreadOnly && styles.segmentTextActive]}>All</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange({ unreadOnly: true })}
          style={[styles.segmentButton, filters.unreadOnly && styles.segmentActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: filters.unreadOnly }}
        >
          <Text style={[styles.segmentText, filters.unreadOnly && styles.segmentTextActive]}>Unread</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All categories" selected={filters.type === null} onPress={() => onChange({ type: null })} />
        {TYPE_ORDER.map((type: NotificationType) => (
          <Chip
            key={type}
            label={TYPE_META[type].label}
            selected={filters.type === type}
            onPress={() => onChange({ type: filters.type === type ? null : type })}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Any priority" selected={filters.priority === null} onPress={() => onChange({ priority: null })} />
        {PRIORITY_ORDER.map((priority: NotificationPriority) => (
          <Chip
            key={priority}
            label={PRIORITY_META[priority].label}
            selected={filters.priority === priority}
            onPress={() => onChange({ priority: filters.priority === priority ? null : priority })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingTop: spacing.md },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { ...typography.bodyStrong, color: colors.textSecondary },
  segmentTextActive: { color: colors.primary },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },
});