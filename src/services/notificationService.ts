import { apiDelete, apiGet, apiPatch } from './apiClient';
import type {
  AppNotification,
  MarkAllReadResponse,
  NotificationFilters,
  NotificationPage,
  UnreadCountResponse,
} from '@/types/notifications';

/** The REST calls behind the Alerts screen. The backend decides what each user may see. */
export function listNotifications(
  filters: NotificationFilters,
  offset: number,
  limit: number,
): Promise<NotificationPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sort: 'newest' });
  if (filters.type) params.set('type', filters.type);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.unreadOnly) params.set('is_read', 'false');
  return apiGet<NotificationPage>(`/api/notifications?${params.toString()}`);
}

export async function getUnreadCount(): Promise<number> {
  const body = await apiGet<UnreadCountResponse>('/api/notifications/unread-count');
  return body.unreadCount;
}

export function markNotificationRead(id: number): Promise<AppNotification> {
  return apiPatch<AppNotification>(`/api/notifications/${id}/read`, undefined);
}

export function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  return apiPatch<MarkAllReadResponse>('/api/notifications/read-all', undefined);
}

export function deleteNotification(id: number): Promise<void> {
  return apiDelete(`/api/notifications/${id}`);
}