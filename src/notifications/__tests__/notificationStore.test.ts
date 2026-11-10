import { describe, expect, it } from '@jest/globals';

import { createNotificationStore, type NotificationsApi } from '../notificationStore';
import type { AppNotification, MarkAllReadResponse, NotificationFilters, NotificationPage } from '@/types/notifications';

function make(id: number, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    title: `Alert ${id}`,
    message: `Message ${id}`,
    type: 'order',
    priority: 'medium',
    relatedEntityType: null,
    relatedEntityId: null,
    isRead: false,
    createdAt: '2026-11-05T09:00:00Z',
    readAt: null,
    ...overrides,
  };
}

/** A fake backend: holds notifications in memory and can be told to fail. */
function fakeApi(initial: AppNotification[]) {
  let rows = [...initial];
  const failing = new Set<string>();
  const calls: string[] = [];

  function guard(name: string): void {
    calls.push(name);
    if (failing.has(name)) throw new Error(`${name} failed`);
  }

  const api: NotificationsApi = {
    async list(filters: NotificationFilters, offset: number, limit: number): Promise<NotificationPage> {
      guard('list');
      const filtered = rows.filter(
        (n) =>
          (!filters.type || n.type === filters.type) &&
          (!filters.priority || n.priority === filters.priority) &&
          (!filters.unreadOnly || !n.isRead),
      );
      return { items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
    },
    async unreadCount(): Promise<number> {
      guard('unreadCount');
      return rows.filter((n) => !n.isRead).length;
    },
    async markRead(id: number): Promise<AppNotification> {
      guard('markRead');
      rows = rows.map((n) => (n.id === id ? { ...n, isRead: true, readAt: 'now' } : n));
      return rows.find((n) => n.id === id) as AppNotification;
    },
    async markAllRead(): Promise<MarkAllReadResponse> {
      guard('markAllRead');
      const updated = rows.filter((n) => !n.isRead).length;
      rows = rows.map((n) => ({ ...n, isRead: true, readAt: 'now' }));
      return { updated, unreadCount: 0 };
    },
    async remove(id: number): Promise<void> {
      guard('remove');
      rows = rows.filter((n) => n.id !== id);
    },
  };
  return { api, fail: (name: string) => failing.add(name), calls, rows: () => rows };
}

async function loaded(initial: AppNotification[]) {
  const backend = fakeApi(initial);
  const store = createNotificationStore(backend.api, () => 0);
  await store.load();
  return { store, backend };
}

const three = [make(3), make(2), make(1, { isRead: true })];

describe('loading', () => {
  it('loads the list and the unread count from the API', async () => {
    const { store } = await loaded(three);
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.items.map((n) => n.id)).toEqual([3, 2, 1]);
    expect(state.total).toBe(3);
    expect(state.unreadCount).toBe(2);
  });

  it('shows an error state when the first load fails and recovers on retry', async () => {
    const backend = fakeApi(three);
    backend.fail('list');
    const store = createNotificationStore(backend.api);
    await store.load();
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('list failed');

    backend.api.list = fakeApi(three).api.list;
    await store.load();
    expect(store.getState().status).toBe('ready');
  });

  it('a failed pull-to-refresh keeps the list and shows a banner instead', async () => {
    const { store, backend } = await loaded(three);
    backend.fail('list');
    await store.refresh();
    expect(store.getState().items).toHaveLength(3);
    expect(store.getState().status).toBe('ready');
    expect(store.getState().actionError).toBe('list failed');
  });

  it('loads further pages without duplicating rows', async () => {
    const many = Array.from({ length: 25 }, (_, i) => make(25 - i));
    const { store } = await loaded(many);
    expect(store.getState().items).toHaveLength(20);
    await store.loadMore();
    expect(store.getState().items).toHaveLength(25);
    expect(new Set(store.getState().items.map((n) => n.id)).size).toBe(25);
    await store.loadMore(); // nothing left
    expect(store.getState().items).toHaveLength(25);
  });
});

describe('filters', () => {
  it('reloads from the server with the chosen filters', async () => {
    const { store } = await loaded([make(3, { type: 'revenue' }), make(2, { priority: 'high' }), make(1)]);
    await store.setFilters({ type: 'revenue' });
    expect(store.getState().items.map((n) => n.id)).toEqual([3]);
    await store.setFilters({ type: null, priority: 'high' });
    expect(store.getState().items.map((n) => n.id)).toEqual([2]);
    await store.setFilters({ priority: null, unreadOnly: true });
    expect(store.getState().items).toHaveLength(3);
  });
});

describe('live notifications', () => {
  it('adds a pushed notification to the top and raises the unread count', async () => {
    const { store } = await loaded(three);
    store.receive(make(4, { priority: 'high' }));
    expect(store.getState().items.map((n) => n.id)).toEqual([4, 3, 2, 1]);
    expect(store.getState().unreadCount).toBe(3);
    expect(store.getState().total).toBe(4);
  });

  it('ignores the same notification delivered twice', async () => {
    const { store } = await loaded(three);
    store.receive(make(4));
    store.receive(make(4));
    expect(store.getState().items.filter((n) => n.id === 4)).toHaveLength(1);
    expect(store.getState().unreadCount).toBe(3);
  });

  it('counts a notification that does not match the filter but does not list it', async () => {
    const { store } = await loaded([make(1, { type: 'revenue' })]);
    await store.setFilters({ type: 'revenue' });
    store.receive(make(9, { type: 'order' }));
    expect(store.getState().items.map((n) => n.id)).toEqual([1]);
    expect(store.getState().unreadCount).toBe(2);
  });
});

describe('mark as read (optimistic)', () => {
  it('updates immediately, then matches the backend count', async () => {
    const { store, backend } = await loaded(three);
    const pending = store.markRead(3);
    expect(store.getState().items[0].isRead).toBe(true); // before the API answered
    expect(store.getState().unreadCount).toBe(1);
    await pending;
    expect(store.getState().unreadCount).toBe(1);
    expect(backend.calls).toContain('markRead');
  });

  it('rolls back the row and the count when the API fails, and shows the error', async () => {
    const { store, backend } = await loaded(three);
    backend.fail('markRead');
    await store.markRead(3);
    const state = store.getState();
    expect(state.items[0].isRead).toBe(false);
    expect(state.items[0].readAt).toBeNull();
    expect(state.unreadCount).toBe(2);
    expect(state.actionError).toBe('markRead failed');
  });

  it('in the unread-only view the row leaves the list, and returns in place on failure', async () => {
    const { store, backend } = await loaded([make(3), make(2), make(1)]);
    await store.setFilters({ unreadOnly: true });
    backend.fail('markRead');
    const pending = store.markRead(2);
    expect(store.getState().items.map((n) => n.id)).toEqual([3, 1]);
    await pending;
    expect(store.getState().items.map((n) => n.id)).toEqual([3, 2, 1]);
    expect(store.getState().total).toBe(3);
    expect(store.getState().unreadCount).toBe(3);
  });

  it('does nothing for a notification that is already read', async () => {
    const { store, backend } = await loaded(three);
    const before = backend.calls.length;
    await store.markRead(1);
    expect(backend.calls.length).toBe(before);
  });

  it('keeps a live arrival that happened while the request was failing', async () => {
    const { store, backend } = await loaded(three);
    backend.fail('markRead');
    const pending = store.markRead(3);
    store.receive(make(10));
    await pending;
    expect(store.getState().items.map((n) => n.id)).toEqual([10, 3, 2, 1]);
    expect(store.getState().unreadCount).toBe(3); // 2 original + 1 new, the failed read rolled back
  });
});

describe('mark all as read', () => {
  it('clears the count immediately and uses the backend count afterwards', async () => {
    const { store } = await loaded(three);
    const pending = store.markAllRead();
    expect(store.getState().unreadCount).toBe(0);
    expect(store.getState().items.every((n) => n.isRead)).toBe(true);
    await pending;
    expect(store.getState().unreadCount).toBe(0);
  });

  it('restores exactly the rows that were unread when the API fails', async () => {
    const { store, backend } = await loaded(three);
    backend.fail('markAllRead');
    await store.markAllRead();
    const state = store.getState();
    expect(state.items.map((n) => n.isRead)).toEqual([false, false, true]);
    expect(state.unreadCount).toBe(2);
    expect(state.actionError).toBe('markAllRead failed');
  });
});

describe('delete', () => {
  it('removes the row at once and lowers the unread count for an unread row', async () => {
    const { store } = await loaded(three);
    const pending = store.remove(3);
    expect(store.getState().items.map((n) => n.id)).toEqual([2, 1]);
    expect(store.getState().unreadCount).toBe(1);
    await pending;
    expect(store.getState().total).toBe(2);
  });

  it('does not change the unread count when a read row is deleted', async () => {
    const { store } = await loaded(three);
    await store.remove(1);
    expect(store.getState().unreadCount).toBe(2);
  });

  it('puts the row back in the same place when the API fails', async () => {
    const { store, backend } = await loaded(three);
    backend.fail('remove');
    await store.remove(2);
    expect(store.getState().items.map((n) => n.id)).toEqual([3, 2, 1]);
    expect(store.getState().unreadCount).toBe(2);
    expect(store.getState().total).toBe(3);
    expect(store.getState().actionError).toBe('remove failed');
  });
});

describe('reset (logout)', () => {
  it('forgets everything and ignores answers that arrive afterwards', async () => {
    const backend = fakeApi(three);
    const store = createNotificationStore(backend.api);
    const pending = store.load();
    store.reset();
    await pending;
    expect(store.getState().items).toEqual([]);
    expect(store.getState().status).toBe('idle');
  });
});