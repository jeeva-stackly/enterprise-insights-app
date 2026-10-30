import { ApiError, apiGet, apiPatch, apiPost } from './apiClient';
import type { AuthUser, CreateUserInput, LoginResponse, Role, UserListResponse, UserStatus } from '@/types/auth';

/** Login is the one call where 401/403 mean "bad credentials / disabled", not "session expired". */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    return await apiPost<LoginResponse>(
      '/api/auth/login',
      { email: email.trim(), password },
      { auth: false },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw new ApiError('unauthorized', 'Incorrect email or password.', { status: 401, detail: error.detail });
      }
      if (error.status === 403) {
        throw new ApiError('forbidden', 'This account is disabled. Please contact your administrator.', {
          status: 403,
          detail: error.detail,
        });
      }
      if (error.status === 422) {
        throw new ApiError('validation', 'Please enter a valid email and password.', {
          status: 422,
          detail: error.detail,
        });
      }
    }
    throw error;
  }
}

export function getMe(): Promise<AuthUser> {
  return apiGet<AuthUser>('/api/auth/me');
}

export function listUsers(): Promise<UserListResponse> {
  return apiGet<UserListResponse>('/api/users?limit=100&offset=0');
}

export function createUser(input: CreateUserInput): Promise<AuthUser> {
  return apiPost<AuthUser>('/api/users', {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    password: input.password,
    role: input.role,
  });
}

export function updateUserRole(id: number, role: Role): Promise<AuthUser> {
  return apiPatch<AuthUser>(`/api/users/${id}/role`, { role });
}

export function updateUserStatus(id: number, status: UserStatus): Promise<AuthUser> {
  return apiPatch<AuthUser>(`/api/users/${id}/status`, { status });
}