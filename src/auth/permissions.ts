import type { Role } from '@/types/auth';

/** Mirrors the backend permission table. The server still enforces everything; this only shapes the UI. */
export function canManageUsers(role: Role | undefined): boolean {
  return role === 'admin';
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export const ALL_ROLES: Role[] = ['admin', 'analyst', 'viewer'];