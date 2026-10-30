import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValueStore } from '@/auth/session';

/**
 * Token storage backed by the OS keystore (Android Keystore / iOS Keychain).
 * Never AsyncStorage: that is plain text on disk.
 */
export const secureStore: SecureKeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};