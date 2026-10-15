import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './apiConfig';

export type ApiErrorKind = 'network' | 'timeout' | 'server' | 'invalid-response';

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

const USER_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Can't reach the server. Check your connection and try again.",
  timeout: 'The server is taking too long to respond. Please try again.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  'invalid-response': 'We received unexpected data from the server. Please try again.',
};

/** Typed GET request with timeout and normalised errors. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  try {
    console.log(`[api] GET ${API_BASE_URL}${path}`);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError('server', USER_MESSAGES.server, {
        status: response.status,
        detail: `GET ${path} responded ${response.status}`,
      });
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('invalid-response', USER_MESSAGES['invalid-response'], {
        detail: `GET ${path} returned a non-JSON body`,
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('timeout', USER_MESSAGES.timeout, { detail: `GET ${path} timed out` });
    }
    throw new ApiError('network', USER_MESSAGES.network, {
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}