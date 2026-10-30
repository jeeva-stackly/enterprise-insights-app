import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/apiClient';
import { createUser, listUsers, updateUserRole, updateUserStatus } from '@/services/authService';
import type { AuthUser, CreateUserInput, Role, UserStatus } from '@/types/auth';

const FALLBACK = 'Something went wrong. Please try again.';

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : FALLBACK;
}

export function useUsers() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Load error (full-screen when the list is empty). */
  const [error, setError] = useState<string | null>(null);
  /** Error from the last action (role/status change); shown as a banner. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await listUsers();
      if (!mounted.current) return;
      setUsers(response.items);
      setError(null);
    } catch (e) {
      if (mounted.current) setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load().finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (mounted.current) setRefreshing(false);
  }, [load]);

  const retry = useCallback(async () => {
    setLoading(true);
    await load();
    if (mounted.current) setLoading(false);
  }, [load]);

  const replace = useCallback((updated: AuthUser) => {
    setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
  }, []);

  const changeRole = useCallback(
    async (id: number, role: Role) => {
      setBusyId(id);
      setActionError(null);
      try {
        replace(await updateUserRole(id, role));
      } catch (e) {
        if (mounted.current) setActionError(messageOf(e));
      } finally {
        if (mounted.current) setBusyId(null);
      }
    },
    [replace],
  );

  const changeStatus = useCallback(
    async (id: number, status: UserStatus) => {
      setBusyId(id);
      setActionError(null);
      try {
        replace(await updateUserStatus(id, status));
      } catch (e) {
        if (mounted.current) setActionError(messageOf(e));
      } finally {
        if (mounted.current) setBusyId(null);
      }
    },
    [replace],
  );

  /** Throws an ApiError (user-safe message) so the form can show it inline. */
  const create = useCallback(async (input: CreateUserInput) => {
    const created = await createUser(input);
    if (mounted.current) setUsers((current) => [...current, created]);
  }, []);

  return {
    users,
    loading,
    refreshing,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    busyId,
    refresh,
    retry,
    changeRole,
    changeStatus,
    create,
  };
}