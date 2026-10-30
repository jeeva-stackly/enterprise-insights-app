import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './apiConfig';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'server'
  | 'invalid-response'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation';

/**
 * Error thrown by the API layer. `message` is safe to show to a user;
 * the technical `detail` is for logs only and is never rendered in the UI.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly detail?: string;

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; detail?: string }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

const USER_MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  timeout: 'The server is taking too long to respond. Please try again.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  'invalid-response': 'We received unexpected data from the server. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  'not-found': "We couldn't find what you were looking for.",
  conflict: 'That change conflicts with existing data.',
  validation: 'Please check the values you entered and try again.',
} as const satisfies Record<ApiErrorKind, string>;

// ---------------------------------------------------------------------------
// Central auth wiring. The token lives in the session module; this file only
// asks for it, so token handling exists in exactly one place.
// ---------------------------------------------------------------------------
interface AuthHooks {
  getToken: () => string | null;
  /** Called on a 401 for a request that carried `tokenUsed`. */
  onUnauthorized: (tokenUsed: string | null) => void;
}

let authHooks: AuthHooks = { getToken: () => null, onUnauthorized: () => undefined };

export function configureApiAuth(hooks: AuthHooks): void {
  authHooks = hooks;
}

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
  /** Set false for public endpoints (login). Default true. */
  auth?: boolean;
}

type Method = 'GET' | 'POST' | 'PATCH';

async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail;
      return typeof detail === 'string' ? detail : undefined;
    }
  } catch {
    // Body was not JSON; fine.
  }
  return undefined;
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, signal, auth = true } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  const token = auth ? authHooks.getToken() : null;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await toApiError(response, method, path, auth ? token : null, auth);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('invalid-response', USER_MESSAGES['invalid-response'], {
        detail: `${method} ${path} returned a non-JSON body`,
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('timeout', USER_MESSAGES.timeout, { detail: `${method} ${path} timed out` });
    }
    throw new ApiError('network', USER_MESSAGES.network, {
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(
  response: Response,
  method: Method,
  path: string,
  tokenUsed: string | null,
  authenticated: boolean,
): Promise<ApiError> {
  const status = response.status;
  const serverDetail = await readDetail(response);
  const detail = `${method} ${path} responded ${status}${serverDetail ? `: ${serverDetail}` : ''}`;

  if (status === 401) {
    // Expired / invalid token on an authenticated call -> end the session (UI returns to Login).
    if (authenticated) authHooks.onUnauthorized(tokenUsed);
    return new ApiError('unauthorized', USER_MESSAGES.unauthorized, { status, detail });
  }
  if (status === 403) return new ApiError('forbidden', USER_MESSAGES.forbidden, { status, detail });
  if (status === 404) return new ApiError('not-found', USER_MESSAGES['not-found'], { status, detail });
  if (status === 409) {
    // Our own backend writes these messages (e.g. "email already exists"); safe to show.
    return new ApiError('conflict', serverDetail ?? USER_MESSAGES.conflict, { status, detail });
  }
  if (status === 422) return new ApiError('validation', USER_MESSAGES.validation, { status, detail });
  return new ApiError('server', USER_MESSAGES.server, { status, detail });
}

/** Typed GET request with timeout, auth header and normalised errors. */
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, { signal });
}

export function apiPost<T>(path: string, body: unknown, options?: Pick<RequestOptions, 'auth' | 'signal'>): Promise<T> {
  return request<T>('POST', path, { ...options, body });
}

export function apiPatch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>('PATCH', path, { body, signal });
}