import { configureApiAuth } from '@/services/apiClient';
import { getMe } from '@/services/authService';
import { secureStore } from '@/services/authStorage';
import { createSession } from './session';

/** The one app-wide session (SecureStore-backed). Imported by AuthContext only. */
export const authSession = createSession({ store: secureStore, loadUser: getMe });

// Hand the API client the token and tell it what to do on a 401.
configureApiAuth({
  getToken: () => authSession.getToken(),
  onUnauthorized: (tokenUsed) => {
    void authSession.expire(tokenUsed);
  },
});