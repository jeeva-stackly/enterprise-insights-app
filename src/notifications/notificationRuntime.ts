import { authSession } from '@/auth/authSession';
import { API_BASE_URL } from '@/services/apiConfig';
import {
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService';
import { createNotificationStore } from './notificationStore';
import { createNotificationSocket, type SocketLike } from './socketClient';
import { toNotificationsSocketUrl } from './wsUrl';

/**
 * The ONE store and the ONE WebSocket for the whole app. They are created once (module level), so
 * navigating between screens can never create a second connection. Only NotificationsProvider
 * starts and stops them (login / logout).
 */
export const notificationStore = createNotificationStore({
  list: listNotifications,
  unreadCount: getUnreadCount,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  remove: deleteNotification,
});

export const notificationSocket = createNotificationSocket({
  url: toNotificationsSocketUrl(API_BASE_URL),
  // React Native's WebSocket has the same shape as the browser one.
  createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
  getToken: () => authSession.getToken(),
  onStatus: (status) => notificationStore.setConnection(status),
  onReady: (unreadCount, isReconnect) => {
    notificationStore.setUnreadCount(unreadCount);
    // After a reconnect we may have missed alerts: reload the list from PostgreSQL.
    if (isReconnect && notificationStore.getState().status === 'ready') void notificationStore.refresh();
  },
  onNotification: (notification) => notificationStore.receive(notification),
  // The server rejected our token: the session is over, so go back to Login.
  onAuthRejected: () => {
    void authSession.expire(authSession.getToken());
  },
});