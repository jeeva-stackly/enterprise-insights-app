import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConnectionIndicator } from '@/components/notifications/ConnectionIndicator';
import { NotificationFilters } from '@/components/notifications/NotificationFilters';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { StatusView } from '@/components/common/StatusView';
import { useNotifications } from '@/notifications/NotificationsContext';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

export function AlertsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const n = useNotifications();
  const { status, load, markRead, remove } = n;

  // First visit: load the list. Live updates keep it current afterwards (no manual refresh needed).
  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  const confirmDelete = useCallback(
    (id: number) => {
      Alert.alert('Delete alert', 'Remove this alert from your list?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove(id) },
      ]);
    },
    [remove],
  );

  const open = useCallback((id: number) => void markRead(id), [markRead]);

  if (status === 'idle' || status === 'loading') {
    return <StatusView variant="loading" title="Loading alerts..." />;
  }
  if (status === 'error' && n.items.length === 0) {
    return (
      <StatusView
        variant="error"
        title="Couldn't load alerts"
        message={n.error ?? undefined}
        actionLabel="Retry"
        onActionPress={() => void load()}
      />
    );
  }

  const filtered = n.filters.type !== null || n.filters.priority !== null || n.filters.unreadOnly;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Alerts</Text>
          <View style={styles.subRow}>
            <View style={[styles.unreadPill, n.unreadCount === 0 && styles.unreadPillZero]}>
              <Text style={[styles.unreadText, n.unreadCount === 0 && styles.unreadTextZero]}>
                {n.unreadCount} unread
              </Text>
            </View>
            <ConnectionIndicator status={n.connection} />
          </View>
        </View>
        <Pressable
          onPress={() => void n.markAllRead()}
          disabled={n.unreadCount === 0}
          style={({ pressed }) => [
            styles.markAll,
            n.unreadCount === 0 && styles.markAllDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Mark all alerts as read"
          accessibilityState={{ disabled: n.unreadCount === 0 }}
        >
          <Ionicons name="checkmark-done" size={18} color={n.unreadCount === 0 ? colors.textMuted : colors.surface} />
          <Text style={[styles.markAllText, n.unreadCount === 0 && styles.markAllTextDisabled]}>Mark all read</Text>
        </Pressable>
      </View>

      <NotificationFilters filters={n.filters} onChange={(patch) => void n.setFilters(patch)} />

      {n.actionError ? (
        <Pressable onPress={n.clearActionError} style={styles.banner} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.negative} />
          <Text style={styles.bannerText}>{n.actionError}</Text>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      <FlatList
        data={n.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        refreshControl={<RefreshControl refreshing={n.refreshing} onRefresh={() => void n.refresh()} />}
        onEndReached={() => void n.loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{filtered ? 'No alerts match these filters' : "You're all caught up"}</Text>
            <Text style={styles.emptyText}>
              {filtered
                ? 'Try another category or priority.'
                : 'New business alerts appear here the moment they happen.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          n.loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <NotificationItem notification={item} onPress={open} onMarkRead={open} onDelete={confirmDelete} />
        )}
      />
    </View>
  );
}

function Separator(): React.JSX.Element {
  return <View style={{ height: spacing.md }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerText: { gap: spacing.xs + 2 },
  title: { ...typography.title, color: colors.navy },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unreadPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  unreadPillZero: { backgroundColor: colors.border },
  unreadText: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
  unreadTextZero: { color: colors.textSecondary },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  markAllDisabled: { backgroundColor: colors.border },
  markAllText: { ...typography.bodyStrong, color: colors.surface },
  markAllTextDisabled: { color: colors.textMuted },
  pressed: { opacity: 0.85 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.negativeSoft,
  },
  bannerText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl * 2 },
  emptyTitle: { ...typography.heading, color: colors.textPrimary, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  footer: { paddingVertical: spacing.lg },
});