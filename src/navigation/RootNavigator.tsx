import React from 'react';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';

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

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer theme={navTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}