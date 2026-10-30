import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import type { MainTabParamList } from '@/types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface TabMeta {
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/** Record over route names: a new route without metadata is a compile error. */
export const TAB_META: Record<keyof MainTabParamList, TabMeta> = {
  Dashboard: { label: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  Analytics: { label: 'Analytics', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  Alerts: { label: 'Alerts', icon: 'notifications-outline', iconActive: 'notifications' },
  Profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
  UserManagement: { label: 'Users', icon: 'people-outline', iconActive: 'people' },
};