import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatusViewProps {
  variant: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onActionPress?: () => void;
}

/** Full-area loading / error / empty state. Pure UI: knows nothing about the API. */
export function StatusView({
  variant,
  title,
  message,
  icon,
  actionLabel,
  onActionPress,
}: StatusViewProps): React.JSX.Element {
  const fallbackIcon: IconName = variant === 'error' ? 'cloud-offline-outline' : 'file-tray-outline';

  return (
    <View style={styles.container} accessibilityRole={variant === 'error' ? 'alert' : undefined}>
      {variant === 'loading' ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <View style={[styles.iconWrap, variant === 'error' && styles.iconWrapError]}>
          <Ionicons
            name={icon ?? fallbackIcon}
            size={32}
            color={variant === 'error' ? colors.negative : colors.primary}
          />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapError: { backgroundColor: colors.negativeSoft },
  title: { ...typography.heading, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { ...typography.bodyStrong, color: '#fff' },
});