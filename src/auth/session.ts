import type { AuthUser } from '@/types/auth';

/**
 * Pure session logic: no React, no native modules. The secure storage and the
 * "fetch current user" call are injected, so this file is unit-tested in Jest
 * (see __tests__/session.test.ts).
 */

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export interface SecureKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const SESSION_KEY = 'auth.session';

interface StoredSession {
  token: string;
  /** Epoch milliseconds when the token stops being valid. */
  expiresAt: number;
}

export interface SessionOptions {
  store: SecureKeyValueStore;
  /** Called after the token is in memory; must use that token (via the API client). */
  loadUser: () => Promise<AuthUser>;
  now?: () => number;
}

type Listener = (state: AuthState) => void;

export function createSession({ store, loadUser, now = Date.now }: SessionOptions) {
  let token: string | null = null;
  let state: AuthState = { status: 'loading', user: null };
  const listeners = new Set<Listener>();

  function setState(next: AuthState): void {
    state = next;
    listeners.forEach((listener) => listener(state));
  }

  async function wipeStorage(): Promise<void> {
    try {
      await store.remove(SESSION_KEY);
    } catch {
      // Nothing useful to do; the in-memory session is already gone.
    }
  }

  async function signOut(): Promise<void> {
    token = null;
    setState({ status: 'unauthenticated', user: null });
    await wipeStorage();
  }

  /** Start a session for a token that was just issued by the server. */
  async function signIn(newToken: string, expiresInSeconds: number): Promise<AuthUser> {
    token = newToken;
    try {
      const user = await loadUser();
      const stored: StoredSession = { token: newToken, expiresAt: now() + expiresInSeconds * 1000 };
      await store.set(SESSION_KEY, JSON.stringify(stored));
      setState({ status: 'authenticated', user });
      return user;
    } catch (error) {
      await signOut();
      throw error;
    }
  }

  /** Run once on app start: bring back a saved session if it is still valid. */
  async function restore(): Promise<void> {
    try {
      const raw = await store.get(SESSION_KEY);
      if (!raw) {
        setState({ status: 'unauthenticated', user: null });
        return;
      }
      const stored = JSON.parse(raw) as Partial<StoredSession>;
      if (typeof stored.token !== 'string' || typeof stored.expiresAt !== 'number' || stored.expiresAt <= now()) {
        await signOut();
        return;
      }
      token = stored.token;
      const user = await loadUser();
      setState({ status: 'authenticated', user });
    } catch {
      await signOut();
    }
  }

  /** Called by the API client on a 401 for the token it used; ignored if the session already moved on. */
  async function expire(tokenThatFailed: string | null): Promise<void> {
    if (tokenThatFailed !== null && tokenThatFailed !== token) return;
    if (state.status === 'unauthenticated') return;
    await signOut();
  }

  return {
    getToken: (): string | null => token,
    getState: (): AuthState => state,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    signIn,
    signOut,
    restore,
    expire,
  };
}

export type Session = ReturnType<typeof createSession>;