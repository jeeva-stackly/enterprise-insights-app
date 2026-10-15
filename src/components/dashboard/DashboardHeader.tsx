import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

interface DashboardHeaderProps {
  greeting: string;
  userName: string;
  unreadCount?: number;
  onProfilePress: () => void;
  onNotificationsPress: () => void;
}

export function DashboardHeader({
  greeting,
  userName,
  unreadCount = 0,
  onProfilePress,
  onNotificationsPress,
}: DashboardHeaderProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onProfilePress}
        style={styles.profile}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={22} color={colors.primary} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {userName}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onNotificationsPress}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.navy} />
        {unreadCount > 0 ? (
          <View style={styles.dot}>
            <Text style={styles.dotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profile: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: MIN_TOUCH, gap: spacing.md },
  avatar: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flexShrink: 1 },
  greeting: { ...typography.caption, color: colors.textSecondary },
  name: { ...typography.title, color: colors.textPrimary },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.negative,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});