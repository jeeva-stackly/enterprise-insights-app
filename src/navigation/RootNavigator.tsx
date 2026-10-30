import React from 'react';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';

import { useAuth } from '@/auth/AuthContext';
import { StatusView } from '@/components/common/StatusView';
import { LoginScreen } from '@/screens/LoginScreen';
import { colors } from '@/theme';
import { MainTabs } from './MainTabs';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.textPrimary,
    border: colors.border,
  },
};

/**
 * Root of navigation, driven by auth state:
 * restoring the saved session -> splash, signed out -> Login, signed in -> role-based tabs.
 * Leaving MainTabs unmounts it, so a logout/expiry also resets navigation state.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return <StatusView variant="loading" title="Loading..." />;
  }
  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }
  return (
    <NavigationContainer theme={navTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}