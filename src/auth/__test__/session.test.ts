import { createSession, SESSION_KEY, type SecureKeyValueStore } from '../session';
import type { AuthUser } from '@/types/auth';
import { describe, expect, it } from '@jest/globals';

const user: AuthUser = { id: 1, fullName: 'Test Admin', email: 'a@x.com', role: 'admin', status: 'active' };

function memoryStore(): SecureKeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      data.set(k, v);
    },
    remove: async (k) => {
      data.delete(k);
    },
  };
}

describe('session', () => {
  it('signIn stores the token and exposes the user', async () => {
    const store = memoryStore();
    const session = createSession({ store, loadUser: async () => user });
    await session.signIn('tok', 3600);
    expect(session.getToken()).toBe('tok');
    expect(session.getState()).toEqual({ status: 'authenticated', user });
    expect(store.data.has(SESSION_KEY)).toBe(true);
  });

  it('logout clears the stored token, in-memory token and user', async () => {
    const store = memoryStore();
    const session = createSession({ store, loadUser: async () => user });
    await session.signIn('tok', 3600);
    await session.signOut();
    expect(store.data.size).toBe(0);
    expect(session.getToken()).toBeNull();
    expect(session.getState()).toEqual({ status: 'unauthenticated', user: null });
  });

  it('restore brings back a valid saved session', async () => {
    const store = memoryStore();
    store.data.set(SESSION_KEY, JSON.stringify({ token: 'tok', expiresAt: 10_000 }));
    const session = createSession({ store, loadUser: async () => user, now: () => 1_000 });
    await session.restore();
    expect(session.getToken()).toBe('tok');
    expect(session.getState().status).toBe('authenticated');
  });

  it('restore discards an expired saved session', async () => {
    const store = memoryStore();
    store.data.set(SESSION_KEY, JSON.stringify({ token: 'tok', expiresAt: 500 }));
    const session = createSession({ store, loadUser: async () => user, now: () => 1_000 });
    await session.restore();
    expect(store.data.size).toBe(0);
    expect(session.getState().status).toBe('unauthenticated');
  });

  it('restore with nothing saved goes to unauthenticated', async () => {
    const session = createSession({ store: memoryStore(), loadUser: async () => user });
    await session.restore();
    expect(session.getState().status).toBe('unauthenticated');
  });

  it('restore clears the session when the server rejects the token', async () => {
    const store = memoryStore();
    store.data.set(SESSION_KEY, JSON.stringify({ token: 'tok', expiresAt: 10_000 }));
    const session = createSession({
      store,
      loadUser: async () => {
        throw new Error('401');
      },
      now: () => 1_000,
    });
    await session.restore();
    expect(store.data.size).toBe(0);
    expect(session.getToken()).toBeNull();
  });

  it('expire (401 from API) logs out only for the current token', async () => {
    const store = memoryStore();
    const session = createSession({ store, loadUser: async () => user });
    await session.signIn('new', 3600);
    await session.expire('old');
    expect(session.getState().status).toBe('authenticated');
    await session.expire('new');
    expect(session.getState().status).toBe('unauthenticated');
    expect(store.data.size).toBe(0);
  });

  it('a failed signIn leaves nothing behind', async () => {
    const store = memoryStore();
    const session = createSession({
      store,
      loadUser: async () => {
        throw new Error('boom');
      },
    });
    await expect(session.signIn('tok', 3600)).rejects.toThrow('boom');
    expect(store.data.size).toBe(0);
    expect(session.getToken()).toBeNull();
  });
});