import React from 'react';
import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/auth/AuthContext';
import { canManageUsers } from '@/auth/permissions';
import { useNotifications } from '@/notifications/NotificationsContext';
import { AlertsScreen } from '@/screens/AlertsScreen';
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { UserManagementScreen } from '@/screens/UserManagementScreen';
import { colors } from '@/theme';
import type { MainTabParamList } from '@/types/navigation';
import { TAB_META } from './tabConfig';

const Tab = createBottomTabNavigator<MainTabParamList>();

function optionsFor(route: keyof MainTabParamList): BottomTabNavigationOptions {
  const meta = TAB_META[route];
  return {
    tabBarLabel: meta.label,
    tabBarIcon: ({ focused, color, size }) => (
      <Ionicons name={focused ? meta.iconActive : meta.icon} size={size} color={color} />
    ),
  };
}

export function MainTabs(): React.JSX.Element {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const isAdmin = canManageUsers(user?.role);

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // The default tab bar already respects the bottom safe-area inset.
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={optionsFor('Dashboard')} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={optionsFor('Analytics')} />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          ...optionsFor('Alerts'),
          // Unread indicator on the tab, driven by the live count (hidden at zero).
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.negative, color: '#FFFFFF', fontSize: 11 },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={optionsFor('Profile')} />
      {isAdmin ? (
        <Tab.Screen name="UserManagement" component={UserManagementScreen} options={optionsFor('UserManagement')} />
      ) : null}
    </Tab.Navigator>
  );
}