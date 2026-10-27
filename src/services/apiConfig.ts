import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 8000;

/**
 * Resolves the backend URL for development.
 *
 * 1. EXPO_PUBLIC_API_URL (set in .env) always wins, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
 * 2. Otherwise reuse the IP of the computer running `expo start` (Expo exposes it as hostUri).
 * 3. Android emulator fallback is 10.0.2.2; else localhost.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();
export const REQUEST_TIMEOUT_MS = 10000;