import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import type { NotificationFilters } from '@/types/notifications';
import { notificationSocket, notificationStore } from './notificationRuntime';
import type { NotificationsState } from './notificationStore';

interface NotificationsContextValue extends NotificationsState {
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setFilters: (patch: Partial<NotificationFilters>) => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  clearActionError: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Lives below AuthProvider. Signed in -> open the single WebSocket. Signed out (logout or an expired
 * session) -> close it and wipe the notification state. It is mounted once, so screens never open sockets.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useAuth();
  const state = useSyncExternalStore(notificationStore.subscribe, notificationStore.getState);

  useEffect(() => {
    if (status === 'authenticated') {
      notificationSocket.connect();
    } else if (status === 'unauthenticated') {
      notificationSocket.disconnect();
      notificationStore.reset();
    }
  }, [status]);

  // Closing the whole app tree also closes the socket.
  useEffect(() => () => notificationSocket.disconnect(), []);

  // Back from the background: reconnect now instead of waiting for the backoff timer, and catch up.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || status !== 'authenticated') return;
      notificationSocket.reconnectNow();
      if (notificationStore.getState().status === 'ready') void notificationStore.refresh();
    });
    return () => subscription.remove();
  }, [status]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      ...state,
      load: notificationStore.load,
      refresh: notificationStore.refresh,
      loadMore: notificationStore.loadMore,
      setFilters: notificationStore.setFilters,
      markRead: notificationStore.markRead,
      markAllRead: notificationStore.markAllRead,
      remove: notificationStore.remove,
      clearActionError: notificationStore.clearActionError,
    }),
    [state],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}