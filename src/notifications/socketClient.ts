import type { AppNotification } from '@/types/notifications';

/**
 * WebSocket client for /ws/notifications. Pure TypeScript (no React, no React Native imports): the real
 * WebSocket and the timers are injected, so everything here is unit-tested in Jest.
 *
 * Rules:
 *  - ONE connection: calling connect() while connecting / connected / waiting to reconnect does nothing.
 *  - The JWT is sent as the first message, never in the URL.
 *  - Unexpected close -> reconnect with exponential backoff + jitter (1s, 2s, 4s ... capped at 30s).
 *  - Close code 4401 (token rejected) -> do NOT retry; tell the app so it can end the session.
 *  - disconnect() (logout) closes the socket and cancels every timer; nothing reconnects afterwards.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_TOO_MANY = 4429;

/** The small part of the WebSocket API we use (the real WebSocket satisfies it). */
export interface SocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface SocketClientOptions {
  url: string;
  createSocket: (url: string) => SocketLike;
  getToken: () => string | null;
  onStatus: (status: ConnectionStatus) => void;
  /** Authentication succeeded. `isReconnect` is true when this is not the first successful connection. */
  onReady: (unreadCount: number, isReconnect: boolean) => void;
  onNotification: (notification: AppNotification) => void;
  /** The server rejected our token (close code 4401). */
  onAuthRejected: () => void;
  timers?: Timers;
  now?: () => number;
  random?: () => number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  pingIntervalMs?: number;
  readyTimeoutMs?: number;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** Delay before reconnect attempt number `attempt` (0-based): exponential, capped, with jitter. */
export function backoffDelay(attempt: number, base: number, max: number, random: number): number {
  const exponential = Math.min(max, base * 2 ** attempt);
  return Math.round(exponential * (0.5 + 0.5 * random)); // between 50% and 100% of the step
}

function isNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'number' && typeof v.title === 'string' && typeof v.isRead === 'boolean';
}

export function createNotificationSocket(options: SocketClientOptions) {
  const timers = options.timers ?? defaultTimers;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const baseDelay = options.baseDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 30000;
  const pingEvery = options.pingIntervalMs ?? 25000;
  const readyTimeout = options.readyTimeoutMs ?? 15000;

  let status: ConnectionStatus = 'idle';
  let socket: SocketLike | null = null;
  let wanted = false; // true between connect() and disconnect()
  let attempt = 0;
  let everConnected = false;
  let lastActivity = 0;
  let reconnectTimer: unknown = null;
  let readyTimer: unknown = null;
  let pingTimer: unknown = null;

  function setStatus(next: ConnectionStatus): void {
    if (status === next) return;
    status = next;
    options.onStatus(next);
  }

  function clearTimersAll(): void {
    if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
    if (readyTimer !== null) timers.clearTimeout(readyTimer);
    if (pingTimer !== null) timers.clearInterval(pingTimer);
    reconnectTimer = readyTimer = pingTimer = null;
  }

  function detach(target: SocketLike): void {
    target.onopen = null;
    target.onmessage = null;
    target.onclose = null;
    target.onerror = null;
  }

  function scheduleReconnect(extraDelay = 0): void {
    const delay = Math.max(backoffDelay(attempt, baseDelay, maxDelay, random()), extraDelay);
    attempt += 1;
    setStatus('reconnecting');
    reconnectTimer = timers.setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  }

  function startPing(): void {
    pingTimer = timers.setInterval(() => {
      if (!socket) return;
      if (now() - lastActivity > pingEvery * 2.5) {
        // Silence for too long: the connection is half-dead. Closing triggers the normal reconnect path.
        socket.close(4000, 'stale');
        return;
      }
      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch {
        // The close handler will take care of it.
      }
    }, pingEvery);
  }

  function handleClose(closed: SocketLike, code: number): void {
    if (socket !== closed) return; // an old socket we already replaced
    detach(closed);
    socket = null;
    clearTimersAll();

    if (!wanted) {
      setStatus('closed');
      return;
    }
    if (code === CLOSE_UNAUTHORIZED) {
      wanted = false;
      setStatus('closed');
      options.onAuthRejected();
      return;
    }
    // Too many connections for this user: wait the maximum before trying again.
    scheduleReconnect(code === CLOSE_TOO_MANY ? maxDelay : 0);
  }

  function open(): void {
    const token = options.getToken();
    if (!wanted || !token) {
      setStatus('closed');
      return;
    }
    setStatus(everConnected || attempt > 0 ? 'reconnecting' : 'connecting');

    const created = options.createSocket(options.url);
    socket = created;
    lastActivity = now();

    created.onopen = () => {
      if (socket !== created) return;
      created.send(JSON.stringify({ type: 'auth', token }));
      readyTimer = timers.setTimeout(() => {
        // Connected but never authenticated in time: give up on this socket and retry.
        if (socket === created) created.close(4000, 'auth timeout');
      }, readyTimeout);
    };

    created.onmessage = (event) => {
      if (socket !== created) return;
      lastActivity = now();
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return; // ignore frames we cannot read
      }
      if (!message || typeof message !== 'object') return;
      const frame = message as { type?: unknown; unreadCount?: unknown; data?: unknown };

      if (frame.type === 'ready') {
        if (readyTimer !== null) timers.clearTimeout(readyTimer);
        readyTimer = null;
        const isReconnect = everConnected;
        everConnected = true;
        attempt = 0;
        setStatus('connected');
        startPing();
        options.onReady(typeof frame.unreadCount === 'number' ? frame.unreadCount : 0, isReconnect);
      } else if (frame.type === 'notification' && isNotification(frame.data)) {
        options.onNotification(frame.data);
      }
      // 'pong' and unknown frames only refresh lastActivity.
    };

    created.onerror = () => {
      // Details are not useful here; onclose always follows and decides what to do.
    };

    created.onclose = (event) => handleClose(created, event.code);
  }

  return {
    getStatus: (): ConnectionStatus => status,

    /** Start (or keep) the single connection. Safe to call many times. */
    connect(): void {
      if (wanted && (socket !== null || reconnectTimer !== null)) return;
      wanted = true;
      open();
    },

    /** Reconnect immediately (for example when the app returns to the foreground). */
    reconnectNow(): void {
      if (!wanted || socket !== null) return;
      if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      open();
    },

    /** Close for good (logout). Cancels timers and ignores everything the old socket might still say. */
    disconnect(): void {
      wanted = false;
      attempt = 0;
      everConnected = false;
      clearTimersAll();
      if (socket) {
        const old = socket;
        socket = null;
        detach(old);
        try {
          old.close(1000, 'logout');
        } catch {
          // already closed
        }
      }
      setStatus('closed');
    },
  };
}

export type NotificationSocket = ReturnType<typeof createNotificationSocket>;