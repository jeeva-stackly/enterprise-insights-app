import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import type { NotificationPriority, NotificationType } from '@/types/notifications';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const PRIORITY_META: Record<NotificationPriority, { label: string; color: string; soft: string }> = {
  critical: { label: 'Critical', color: colors.negative, soft: colors.negativeSoft },
  high: { label: 'High', color: '#D9730D', soft: colors.warningSoft },
  medium: { label: 'Medium', color: colors.info, soft: colors.infoSoft },
  low: { label: 'Low', color: colors.textSecondary, soft: colors.border },
};

export const TYPE_META: Record<NotificationType, { label: string; icon: IconName; color: string; soft: string }> = {
  revenue: { label: 'Revenue', icon: 'cash-outline', color: colors.positive, soft: colors.positiveSoft },
  sales: { label: 'Sales', icon: 'trending-up-outline', color: colors.primary, soft: colors.primarySoft },
  order: { label: 'Order', icon: 'cube-outline', color: colors.purple, soft: colors.purpleSoft },
  customer: { label: 'Customer', icon: 'people-outline', color: colors.info, soft: colors.infoSoft },
  system: { label: 'System', icon: 'settings-outline', color: colors.textSecondary, soft: colors.border },
};

export const TYPE_ORDER: NotificationType[] = ['revenue', 'sales', 'order', 'customer', 'system'];
export const PRIORITY_ORDER: NotificationPriority[] = ['critical', 'high', 'medium', 'low'];