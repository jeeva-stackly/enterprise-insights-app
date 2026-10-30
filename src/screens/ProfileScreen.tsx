import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth, useCurrentUser } from '@/auth/AuthContext';
import { ROLE_LABELS } from '@/auth/permissions';
import { Card } from '@/components/common/Card';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function ProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  function confirmLogout(): void {
    Alert.alert('Log out', 'Do you want to log out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setLoggingOut(true);
          void logout(); // clears token + state; the root navigator returns to Login
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg }}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={colors.primary} />
        </View>
        <Text style={styles.name}>{user.fullName}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{ROLE_LABELS[user.role]}</Text>
        </View>
      </View>

      <Card>
        <Row label="Email" value={user.email} />
        <Row label="Role" value={ROLE_LABELS[user.role]} />
        <Row label="Status" value={user.status === 'active' ? 'Active' : 'Disabled'} />
      </Card>

      <Pressable
        onPress={confirmLogout}
        disabled={loggingOut}
        style={({ pressed }) => [styles.logout, (pressed || loggingOut) && styles.logoutPressed]}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        {loggingOut ? (
          <ActivityIndicator color={colors.negative} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.negative} />
            <Text style={styles.logoutText}>Log out</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: { ...typography.title, color: colors.navy, textAlign: 'center' },
  roleBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roleText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.lg },
  rowLabel: { ...typography.body, color: colors.textSecondary },
  rowValue: { ...typography.bodyStrong, color: colors.textPrimary, flexShrink: 1 },
  logout: {
    marginTop: spacing.xl,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.negative,
    backgroundColor: colors.negativeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logoutPressed: { opacity: 0.7 },
  logoutText: { color: colors.negative, fontSize: 16, fontWeight: '700' },
});