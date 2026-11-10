import type { ConnectionStatus } from './socketClient';
import {
  NO_FILTERS,
  type AppNotification,
  type MarkAllReadResponse,
  type NotificationFilters,
  type NotificationPage,
} from '@/types/notifications';

/**
 * All Alerts state and logic, with NO React inside: the REST calls are injected, so the optimistic
 * updates and their rollbacks are unit-tested in Jest. PostgreSQL (through the API) is always the
 * truth: after every change the unread count is re-read from the server.
 */

export const PAGE_SIZE = 20;

export interface NotificationsApi {
  list(filters: NotificationFilters, offset: number, limit: number): Promise<NotificationPage>;
  unreadCount(): Promise<number>;
  markRead(id: number): Promise<AppNotification>;
  markAllRead(): Promise<MarkAllReadResponse>;
  remove(id: number): Promise<void>;
}

export interface NotificationsState {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  filters: NotificationFilters;
  /** 'loading' only for the first load / a filter change; pull-to-refresh uses `refreshing`. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  refreshing: boolean;
  loadingMore: boolean;
  /** Why the list could not be loaded (shown instead of the list when it is empty). */
  error: string | null;
  /** Why the last action (read / delete) failed and was rolled back (shown as a banner). */
  actionError: string | null;
  connection: ConnectionStatus;
}

type Listener = (state: NotificationsState) => void;

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.';
}

function matches(filters: NotificationFilters, n: AppNotification): boolean {
  if (filters.type && n.type !== filters.type) return false;
  if (filters.priority && n.priority !== filters.priority) return false;
  if (filters.unreadOnly && n.isRead) return false;
  return true;
}

const initialState = (): NotificationsState => ({
  items: [],
  total: 0,
  unreadCount: 0,
  filters: NO_FILTERS,
  status: 'idle',
  refreshing: false,
  loadingMore: false,
  error: null,
  actionError: null,
  connection: 'idle',
});

export function createNotificationStore(api: NotificationsApi, now: () => number = Date.now) {
  let state: NotificationsState = initialState();
  const listeners = new Set<Listener>();
  let loadSeq = 0; // answers that arrive after a newer request started are ignored
  let pendingMutations = 0; // while an optimistic change is in flight we do not overwrite the count
  const receivedIds = new Set<number>(); // live deliveries already counted

  function set(patch: Partial<NotificationsState>): void {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  }

  /** Re-read the unread count from the server (the source of truth). Never throws. */
  async function syncUnreadCount(): Promise<void> {
    if (pendingMutations > 0) return;
    try {
      const count = await api.unreadCount();
      if (pendingMutations === 0) set({ unreadCount: count });
    } catch {
      // Keep the local number; the next successful call corrects it.
    }
  }

  async function fetchFirstPage(mode: 'initial' | 'refresh'): Promise<void> {
    const seq = ++loadSeq;
    const filters = state.filters;
    set(mode === 'initial' ? { status: 'loading', error: null } : { refreshing: true });
    try {
      const [page, unread] = await Promise.all([api.list(filters, 0, PAGE_SIZE), api.unreadCount()]);
      if (seq !== loadSeq) return;
      set({
        items: page.items,
        total: page.total,
        unreadCount: unread,
        status: 'ready',
        refreshing: false,
        loadingMore: false,
        error: null,
      });
    } catch (error) {
      if (seq !== loadSeq) return;
      // A failed pull-to-refresh keeps the old list on screen and shows a banner instead.
      if (mode === 'refresh' && state.status === 'ready') {
        set({ refreshing: false, actionError: messageOf(error) });
      } else {
        set({ status: 'error', refreshing: false, error: messageOf(error) });
      }
    }
  }

  return {
    getState: (): NotificationsState => state,

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    load: () => fetchFirstPage('initial'),
    refresh: () => fetchFirstPage('refresh'),

    async loadMore(): Promise<void> {
      if (state.status !== 'ready' || state.loadingMore || state.items.length >= state.total) return;
      const seq = loadSeq;
      set({ loadingMore: true });
      try {
        const page = await api.list(state.filters, state.items.length, PAGE_SIZE);
        if (seq !== loadSeq) return;
        const known = new Set(state.items.map((n) => n.id));
        set({
          items: [...state.items, ...page.items.filter((n) => !known.has(n.id))],
          total: page.total,
          loadingMore: false,
        });
      } catch (error) {
        if (seq === loadSeq) set({ loadingMore: false, actionError: messageOf(error) });
      }
    },

    setFilters(patch: Partial<NotificationFilters>): Promise<void> {
      set({ filters: { ...state.filters, ...patch } });
      return fetchFirstPage('initial');
    },

    /** A notification pushed over the WebSocket. Duplicates (same id) are ignored. */
    receive(notification: AppNotification): void {
      if (receivedIds.has(notification.id) || state.items.some((n) => n.id === notification.id)) return;
      receivedIds.add(notification.id);
      const patch: Partial<NotificationsState> = {};
      if (!notification.isRead) patch.unreadCount = state.unreadCount + 1;
      if (matches(state.filters, notification)) {
        patch.items = [notification, ...state.items];
        patch.total = state.total + 1;
      }
      set(patch);
    },

    setUnreadCount: (count: number): void => set({ unreadCount: count }),
    setConnection: (connection: ConnectionStatus): void => set({ connection }),
    clearActionError: (): void => set({ actionError: null }),

    async markRead(id: number): Promise<void> {
      const index = state.items.findIndex((n) => n.id === id);
      const original = state.items[index];
      if (!original || original.isRead) return;

      // Optimistic: show it as read now (in the "unread only" view it leaves the list).
      const removeFromView = state.filters.unreadOnly;
      const readCopy: AppNotification = { ...original, isRead: true, readAt: new Date(now()).toISOString() };
      pendingMutations += 1;
      set({
        items: removeFromView
          ? state.items.filter((n) => n.id !== id)
          : state.items.map((n) => (n.id === id ? readCopy : n)),
        total: removeFromView ? Math.max(0, state.total - 1) : state.total,
        unreadCount: Math.max(0, state.unreadCount - 1),
        actionError: null,
      });
      try {
        await api.markRead(id);
        pendingMutations -= 1;
        await syncUnreadCount();
      } catch (error) {
        pendingMutations -= 1;
        // Roll back just this change (live arrivals in the meantime stay).
        const items = removeFromView
          ? [...state.items.slice(0, index), original, ...state.items.slice(index)]
          : state.items.map((n) => (n.id === id ? original : n));
        set({
          items,
          total: removeFromView ? state.total + 1 : state.total,
          unreadCount: state.unreadCount + 1,
          actionError: messageOf(error),
        });
      }
    },

    async markAllRead(): Promise<void> {
      if (state.unreadCount === 0 && !state.items.some((n) => !n.isRead)) return;
      const before = state.items;
      const previousUnread = state.unreadCount;
      const unreadIds = new Set(before.filter((n) => !n.isRead).map((n) => n.id));
      const stamp = new Date(now()).toISOString();

      pendingMutations += 1;
      set({
        items: state.filters.unreadOnly
          ? []
          : state.items.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: stamp })),
        total: state.filters.unreadOnly ? 0 : state.total,
        unreadCount: 0,
        actionError: null,
      });
      try {
        const result = await api.markAllRead();
        pendingMutations -= 1;
        set({ unreadCount: result.unreadCount });
      } catch (error) {
        pendingMutations -= 1;
        const restored = state.filters.unreadOnly
          ? [...before.filter((n) => unreadIds.has(n.id)), ...state.items]
          : state.items.map((n) => (unreadIds.has(n.id) ? { ...n, isRead: false, readAt: null } : n));
        set({
          items: restored,
          total: state.filters.unreadOnly ? state.total + before.length : state.total,
          unreadCount: state.unreadCount + previousUnread,
          actionError: messageOf(error),
        });
      }
    },

    async remove(id: number): Promise<void> {
      const index = state.items.findIndex((n) => n.id === id);
      const original = state.items[index];
      if (!original) return;

      pendingMutations += 1;
      set({
        items: state.items.filter((n) => n.id !== id),
        total: Math.max(0, state.total - 1),
        unreadCount: original.isRead ? state.unreadCount : Math.max(0, state.unreadCount - 1),
        actionError: null,
      });
      try {
        await api.remove(id);
        pendingMutations -= 1;
        await syncUnreadCount();
      } catch (error) {
        pendingMutations -= 1;
        set({
          items: [...state.items.slice(0, index), original, ...state.items.slice(index)],
          total: state.total + 1,
          unreadCount: original.isRead ? state.unreadCount : state.unreadCount + 1,
          actionError: messageOf(error),
        });
      }
    },

    /** Forget everything (logout). In-flight answers from before the reset are ignored. */
    reset(): void {
      loadSeq += 1;
      pendingMutations = 0;
      receivedIds.clear();
      state = initialState();
      listeners.forEach((listener) => listener(state));
    },
  };
}

export type NotificationStore = ReturnType<typeof createNotificationStore>;