import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentUser } from '@/auth/AuthContext';
import { ALL_ROLES, ROLE_LABELS } from '@/auth/permissions';
import { CreateUserModal } from '@/components/auth/CreateUserModal';
import { Card } from '@/components/common/Card';
import { StatusView } from '@/components/common/StatusView';
import { useUsers } from '@/hooks/useUsers';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';
import type { AuthUser, Role } from '@/types/auth';

interface RowProps {
  user: AuthUser;
  isSelf: boolean;
  busy: boolean;
  onRole: (role: Role) => void;
  onStatus: (active: boolean) => void;
}

function UserRow({ user, isSelf, busy, onRole, onStatus }: RowProps): React.JSX.Element {
  const active = user.status === 'active';

  function pickRole(role: Role): void {
    if (role === user.role || busy || isSelf) return;
    Alert.alert('Change role', `Make ${user.fullName} ${ROLE_LABELS[role]}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change', onPress: () => onRole(role) },
    ]);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {user.fullName}
            {isSelf ? '  (You)' : ''}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.statusWrap}>
            <Text style={[styles.statusText, { color: active ? colors.positive : colors.textMuted }]}>
              {active ? 'Active' : 'Disabled'}
            </Text>
            <Switch
              value={active}
              disabled={isSelf}
              onValueChange={onStatus}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={`${active ? 'Disable' : 'Enable'} ${user.fullName}`}
            />
          </View>
        )}
      </View>

      <View style={styles.pills}>
        {ALL_ROLES.map((role) => {
          const selected = user.role === role;
          return (
            <Pressable
              key={role}
              onPress={() => pickRole(role)}
              disabled={busy || isSelf}
              style={[styles.pill, selected && styles.pillActive, isSelf && !selected && styles.pillDim]}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: busy || isSelf }}
            >
              <Text style={[styles.pillText, selected && styles.pillTextActive]}>{ROLE_LABELS[role]}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export function UserManagementScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const state = useUsers();
  const [creating, setCreating] = useState(false);

  if (state.loading) return <StatusView variant="loading" title="Loading users..." />;

  if (state.error && state.users.length === 0) {
    return (
      <StatusView
        variant="error"
        title="Couldn't load users"
        message={state.error}
        actionLabel="Retry"
        onActionPress={() => void state.retry()}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>User Management</Text>
          <Text style={styles.subtitle}>{state.users.length} users</Text>
        </View>
        <Pressable
          onPress={() => setCreating(true)}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add user"
        >
          <Ionicons name="add" size={20} color={colors.surface} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      {state.actionError ? (
        <Pressable onPress={state.clearActionError} style={styles.banner} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.negative} />
          <Text style={styles.bannerText}>{state.actionError}</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={state.users}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void state.refresh()} />}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            isSelf={item.id === me.id}
            busy={state.busyId === item.id}
            onRole={(role) => void state.changeRole(item.id, role)}
            onStatus={(active) => void state.changeStatus(item.id, active ? 'active' : 'disabled')}
          />
        )}
      />

      <CreateUserModal visible={creating} onClose={() => setCreating(false)} onSubmit={state.create} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: { ...typography.title, color: colors.navy },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  addText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  bannerText: { ...typography.body, color: colors.negative, flex: 1 },
  card: { gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  info: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { ...typography.caption, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillDim: { opacity: 0.5 },
  pillText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  pillTextActive: { color: colors.surface },
});