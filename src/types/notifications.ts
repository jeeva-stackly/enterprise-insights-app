export type NotificationType = 'revenue' | 'sales' | 'order' | 'customer' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/** One alert exactly as the backend sends it (GET /api/notifications and the WebSocket). */
export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: AppNotification[];
  total: number;
  limit: number;
  offset: number;
}

export interface MarkAllReadResponse {
  updated: number;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface NotificationFilters {
  type: NotificationType | null;
  priority: NotificationPriority | null;
  unreadOnly: boolean;
}

export const NO_FILTERS: NotificationFilters = { type: null, priority: null, unreadOnly: false };