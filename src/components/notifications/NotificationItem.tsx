import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, MIN_TOUCH, radius, shadow, spacing, typography } from '@/theme';
import type { AppNotification } from '@/types/notifications';
import { formatRelativeTime } from '@/utils/time';
import { PRIORITY_META, TYPE_META } from './notificationMeta';
import { PriorityBadge } from './PriorityBadge';

interface Props {
  notification: AppNotification;
  /** Tapping the row marks an unread notification as read. */
  onPress: (id: number) => void;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
}

/** One alert: category icon, title, description, priority, time and read/unread state. */
function NotificationItemBase({ notification: n, onPress, onMarkRead, onDelete }: Props): React.JSX.Element {
  const priority = PRIORITY_META[n.priority];
  const type = TYPE_META[n.type];

  return (
    <Pressable
      onPress={() => onPress(n.id)}
      style={({ pressed }) => [styles.card, !n.isRead && styles.cardUnread, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${n.isRead ? 'Read' : 'Unread'} ${priority.label} priority alert. ${n.title}. ${n.message}`}
    >
      <View style={[styles.accent, { backgroundColor: priority.color }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: type.soft }]}>
            <Ionicons name={type.icon} size={18} color={type.color} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, !n.isRead && styles.titleUnread]} numberOfLines={2}>
              {n.title}
            </Text>
            <Text style={styles.category}>{type.label} alert</Text>
          </View>
          {!n.isRead ? <View style={styles.unreadDot} accessibilityLabel="Unread" /> : null}
        </View>

        <Text style={styles.message}>{n.message}</Text>

        <View style={styles.footer}>
          <View style={styles.meta}>
            <PriorityBadge priority={n.priority} />
            <Text style={styles.time}>{formatRelativeTime(n.createdAt)}</Text>
          </View>
          <View style={styles.actions}>
            {!n.isRead ? (
              <Pressable
                onPress={() => onMarkRead(n.id)}
                style={styles.actionButton}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Mark as read"
              >
                <Ionicons name="checkmark-done-outline" size={20} color={colors.primary} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onDelete(n.id)}
              style={styles.actionButton}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Delete alert"
            >
              <Ionicons name="trash-outline" size={20} color={colors.negative} />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const NotificationItem = React.memo(NotificationItemBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardUnread: { backgroundColor: '#F7F9FF', borderColor: colors.primarySoft },
  pressed: { opacity: 0.9 },
  accent: { width: 5 },
  body: { flex: 1, padding: spacing.md, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  title: { ...typography.bodyStrong, fontWeight: '500', color: colors.textPrimary },
  titleUnread: { fontWeight: '700' },
  category: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  message: { ...typography.body, color: colors.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap' },
  time: { ...typography.caption, color: colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { minWidth: MIN_TOUCH - 8, minHeight: MIN_TOUCH - 8, alignItems: 'center', justifyContent: 'center' },
});