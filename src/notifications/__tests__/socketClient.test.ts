import { describe, expect, it } from '@jest/globals';

import {
  backoffDelay,
  createNotificationSocket,
  type ConnectionStatus,
  type SocketLike,
  type Timers,
} from '../socketClient';
import type { AppNotification } from '@/types/notifications';

class FakeSocket implements SocketLike {
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closedWith: number | null = null;

  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number): void {
    this.closedWith = code ?? 1000;
  }
  // helpers the tests use to play the server
  open(): void {
    this.onopen?.({});
  }
  serverSays(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  serverCloses(code: number): void {
    this.onclose?.({ code });
  }
}

/** Manual clock: timers only fire when the test advances time. */
class FakeTimers implements Timers {
  time = 0;
  private nextId = 1;
  private tasks = new Map<number, { at: number; fn: () => void; every?: number }>();

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.time + ms, fn });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }
  setInterval(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.time + ms, fn, every: ms });
    return id;
  }
  clearInterval(handle: unknown): void {
    this.tasks.delete(handle as number);
  }
  get pending(): number {
    return this.tasks.size;
  }
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      let nextId: number | null = null;
      let nextAt = Infinity;
      this.tasks.forEach((task, id) => {
        if (task.at <= target && task.at < nextAt) {
          nextAt = task.at;
          nextId = id;
        }
      });
      if (nextId === null) break;
      const task = this.tasks.get(nextId);
      if (!task) break;
      this.time = task.at;
      if (task.every) task.at += task.every;
      else this.tasks.delete(nextId);
      task.fn();
    }
    this.time = target;
  }
}

const sample: AppNotification = {
  id: 7,
  title: 'High-Value Order Received',
  message: 'A new order worth ₹2,50,000 has been received (ORD1007).',
  type: 'order',
  priority: 'high',
  relatedEntityType: 'order',
  relatedEntityId: 7,
  isRead: false,
  createdAt: '2026-11-05T09:00:00Z',
  readAt: null,
};

function setup(token: string | null = 'jwt-token') {
  const timers = new FakeTimers();
  const sockets: FakeSocket[] = [];
  const statuses: ConnectionStatus[] = [];
  const received: AppNotification[] = [];
  const readies: Array<{ unread: number; isReconnect: boolean }> = [];
  let authRejected = 0;
  let currentToken = token;

  const client = createNotificationSocket({
    url: 'ws://test/ws/notifications',
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    getToken: () => currentToken,
    onStatus: (s) => statuses.push(s),
    onReady: (unread, isReconnect) => readies.push({ unread, isReconnect }),
    onNotification: (n) => received.push(n),
    onAuthRejected: () => {
      authRejected += 1;
    },
    timers,
    now: () => timers.time,
    random: () => 1, // no jitter: delays are exactly 1s, 2s, 4s ...
  });
  return {
    client,
    timers,
    sockets,
    statuses,
    received,
    readies,
    authRejected: () => authRejected,
    setToken: (t: string | null) => {
      currentToken = t;
    },
  };
}

function connectAndAuthenticate(t: ReturnType<typeof setup>, unread = 3): FakeSocket {
  t.client.connect();
  const socket = t.sockets[t.sockets.length - 1];
  socket.open();
  socket.serverSays({ type: 'ready', unreadCount: unread });
  return socket;
}

describe('backoffDelay', () => {
  it('doubles each attempt and stops growing at the maximum', () => {
    expect([0, 1, 2, 3].map((a) => backoffDelay(a, 1000, 30000, 1))).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffDelay(10, 1000, 30000, 1)).toBe(30000);
  });

  it('applies jitter between 50% and 100% of the step', () => {
    expect(backoffDelay(2, 1000, 30000, 0)).toBe(2000);
    expect(backoffDelay(2, 1000, 30000, 1)).toBe(4000);
  });
});

describe('notification socket', () => {
  it('sends the token as the first message (not in the URL) and reports ready', () => {
    const t = setup();
    const socket = connectAndAuthenticate(t, 5);
    expect(socket.sent[0]).toBe(JSON.stringify({ type: 'auth', token: 'jwt-token' }));
    expect(t.client.getStatus()).toBe('connected');
    expect(t.readies).toEqual([{ unread: 5, isReconnect: false }]);
  });

  it('hands incoming notifications to the app and ignores malformed frames', () => {
    const t = setup();
    const socket = connectAndAuthenticate(t);
    socket.serverSays({ type: 'notification', data: sample });
    socket.serverSays({ type: 'notification', data: { nonsense: true } });
    socket.onmessage?.({ data: 'not json' });
    expect(t.received).toEqual([sample]);
  });

  it('never opens a second connection while one exists (no duplicates when screens change)', () => {
    const t = setup();
    t.client.connect();
    t.client.connect();
    expect(t.sockets).toHaveLength(1);
    t.sockets[0].open();
    t.sockets[0].serverSays({ type: 'ready', unreadCount: 0 });
    t.client.connect();
    expect(t.sockets).toHaveLength(1);
  });

  it('does not connect without a token', () => {
    const t = setup(null);
    t.client.connect();
    expect(t.sockets).toHaveLength(0);
    expect(t.client.getStatus()).toBe('closed');
  });

  it('reconnects with growing delays after an unexpected disconnect and resets after success', () => {
    const t = setup();
    const first = connectAndAuthenticate(t);
    first.serverCloses(1006); // network dropped

    expect(t.client.getStatus()).toBe('reconnecting');
    t.timers.advance(999);
    expect(t.sockets).toHaveLength(1); // still waiting 1s
    t.timers.advance(1);
    expect(t.sockets).toHaveLength(2);

    t.sockets[1].serverCloses(1006); // the retry fails too
    t.timers.advance(1999);
    expect(t.sockets).toHaveLength(2); // 2s this time
    t.timers.advance(1);
    expect(t.sockets).toHaveLength(3);

    t.sockets[2].open();
    t.sockets[2].serverSays({ type: 'ready', unreadCount: 4 });
    expect(t.readies[t.readies.length - 1]).toEqual({ unread: 4, isReconnect: true });

    t.sockets[2].serverCloses(1006); // backoff starts again from 1s
    t.timers.advance(1000);
    expect(t.sockets).toHaveLength(4);
  });

  it('does not retry when the server rejects the token (4401) and tells the app', () => {
    const t = setup();
    t.client.connect();
    t.sockets[0].open();
    t.sockets[0].serverCloses(4401);
    t.timers.advance(120000);
    expect(t.sockets).toHaveLength(1);
    expect(t.authRejected()).toBe(1);
    expect(t.client.getStatus()).toBe('closed');
  });

  it('closing for logout closes the socket, cancels timers and never reconnects', () => {
    const t = setup();
    const socket = connectAndAuthenticate(t);
    t.client.disconnect();

    expect(socket.closedWith).toBe(1000);
    expect(t.client.getStatus()).toBe('closed');
    expect(t.timers.pending).toBe(0);

    socket.serverCloses(1000); // late event from the old socket is ignored
    t.timers.advance(120000);
    expect(t.sockets).toHaveLength(1);
  });

  it('logout while waiting to reconnect cancels the pending retry', () => {
    const t = setup();
    connectAndAuthenticate(t).serverCloses(1006);
    expect(t.timers.pending).toBe(1);
    t.client.disconnect();
    expect(t.timers.pending).toBe(0);
    t.timers.advance(60000);
    expect(t.sockets).toHaveLength(1);
  });

  it('can connect again after logout and login (fresh start, not a reconnect)', () => {
    const t = setup();
    connectAndAuthenticate(t);
    t.client.disconnect();
    connectAndAuthenticate(t);
    expect(t.sockets).toHaveLength(2);
    expect(t.readies[t.readies.length - 1].isReconnect).toBe(false);
  });

  it('keeps the connection alive with pings and drops a silent (half-dead) one', () => {
    const t = setup();
    const socket = connectAndAuthenticate(t);
    t.timers.advance(25000);
    expect(socket.sent[socket.sent.length - 1]).toBe(JSON.stringify({ type: 'ping' }));
    socket.serverSays({ type: 'pong' });

    t.timers.advance(25000 * 3); // nothing heard for a long time
    expect(socket.closedWith).toBe(4000);
  });

  it('retries when the server never answers the login frame', () => {
    const t = setup();
    t.client.connect();
    t.sockets[0].open();
    t.timers.advance(15000);
    expect(t.sockets[0].closedWith).toBe(4000);
  });

  it('waits the maximum delay when the user has too many connections (4429)', () => {
    const t = setup();
    t.client.connect();
    t.sockets[0].open();
    t.sockets[0].serverCloses(4429);
    t.timers.advance(29999);
    expect(t.sockets).toHaveLength(1);
    t.timers.advance(1);
    expect(t.sockets).toHaveLength(2);
  });
});