import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';
import type { Activity, ActivityType } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_STYLE: Record<ActivityType, { icon: IconName; fg: string; bg: string }> = {
  order: { icon: 'cart-outline', fg: colors.primary, bg: colors.primarySoft },
  target: { icon: 'flag-outline', fg: colors.purple, bg: colors.purpleSoft },
  customer: { icon: 'person-add-outline', fg: colors.info, bg: colors.infoSoft },
  payment: { icon: 'card-outline', fg: colors.positive, bg: colors.positiveSoft },
  alert: { icon: 'warning-outline', fg: colors.warning, bg: colors.warningSoft },
};

interface ActivityItemProps {
  activity: Activity;
  showDivider?: boolean;
  onPress?: (activity: Activity) => void;
}

export function ActivityItem({ activity, showDivider = true, onPress }: ActivityItemProps): React.JSX.Element {
  const t = TYPE_STYLE[activity.type];

  return (
    <Pressable
      onPress={onPress ? () => onPress(activity) : undefined}
      disabled={!onPress}
      style={[styles.row, showDivider && styles.divider]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${activity.title}, ${activity.subtitle}, ${activity.timeAgo}`}
    >
      <View style={[styles.icon, { backgroundColor: t.bg }]}>
        <Ionicons name={t.icon} size={20} color={t.fg} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {activity.subtitle}
        </Text>
      </View>

      <View style={styles.meta}>
        {activity.detail ? <Text style={styles.detail}>{activity.detail}</Text> : null}
        <Text style={styles.time}>{activity.timeAgo}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 16,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  meta: { alignItems: 'flex-end', maxWidth: '35%' },
  detail: { ...typography.bodyStrong, color: colors.textPrimary },
  time: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 11 },
});