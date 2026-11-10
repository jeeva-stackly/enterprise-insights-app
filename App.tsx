import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { NotificationsProvider } from '@/notifications/NotificationsContext';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <NotificationsProvider>
          <RootNavigator />
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}