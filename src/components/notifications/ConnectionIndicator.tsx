import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ConnectionStatus } from '@/notifications/socketClient';
import { colors, spacing, typography } from '@/theme';

const META: Record<ConnectionStatus, { label: string; color: string }> = {
  connected: { label: 'Live', color: colors.positive },
  connecting: { label: 'Connecting...', color: colors.warning },
  reconnecting: { label: 'Reconnecting...', color: colors.warning },
  closed: { label: 'Offline', color: colors.textMuted },
  idle: { label: 'Offline', color: colors.textMuted },
};

/** Small dot + label showing whether real-time updates are flowing. */
export function ConnectionIndicator({ status }: { status: ConnectionStatus }): React.JSX.Element {
  const meta = META[status];
  return (
    <View style={styles.row} accessibilityLabel={`Real-time updates: ${meta.label}`}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...typography.caption },
});