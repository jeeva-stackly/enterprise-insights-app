import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, MIN_TOUCH, spacing, typography } from '@/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} hitSlop={8} style={styles.action} accessibilityRole="button">
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH,
  },
  title: { ...typography.heading, color: colors.textPrimary, flexShrink: 1 },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingLeft: spacing.md },
  actionText: { ...typography.bodyStrong, color: colors.primary },
});