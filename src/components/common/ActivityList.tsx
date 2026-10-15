import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import type { Activity } from '@/types';
import { Card } from './Card';
import { ActivityItem } from './ActivityItem';

interface ActivityListProps {
  items: Activity[];
  onItemPress?: (activity: Activity) => void;
}

/**
 * Uses .map() on purpose: the dashboard is one ScrollView, and nesting a
 * FlatList inside it breaks virtualization. The list is short (recent 5-10).
 */
export function ActivityList({ items, onItemPress }: ActivityListProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <Card>
        <Text style={styles.empty}>No recent activity yet.</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View>
        {items.map((item, index) => (
          <ActivityItem
            key={item.id}
            activity={item}
            showDivider={index < items.length - 1}
            onPress={onItemPress}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 0 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.md },
});