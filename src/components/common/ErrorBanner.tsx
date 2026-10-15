import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

/** Inline notice shown above stale content when a refresh fails. */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps): React.JSX.Element {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={20} color={colors.negative} />
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry">
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    marginTop: spacing.md,
  },
  text: { ...typography.caption, color: colors.textPrimary, flex: 1, paddingVertical: spacing.md },
  retry: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.md },
  retryText: { ...typography.bodyStrong, color: colors.negative },
});