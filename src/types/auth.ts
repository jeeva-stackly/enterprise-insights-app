export type Role = 'admin' | 'analyst' | 'viewer';
export type UserStatus = 'active' | 'disabled';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  /** Lifetime of the token in seconds. */
  expiresIn: number;
  user: AuthUser;
}

export interface UserListResponse {
  items: AuthUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}