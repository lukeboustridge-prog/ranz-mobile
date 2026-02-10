/**
 * Auth Store
 *
 * Zustand store for managing authentication state across the mobile app.
 * Uses SecureStore for token persistence and supports offline verification.
 *
 * Features:
 * - Two login methods: email/password (primary) and token (for SSO callbacks)
 * - Offline auth validation with 30-minute grace period (MOBL-03)
 * - SecureStore persistence with WHEN_UNLOCKED_THIS_DEVICE_ONLY security
 */

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

import {
  saveToken,
  getToken,
  deleteToken,
  saveSessionId,
  deleteSessionId,
  saveBiometricsEnabled,
  getBiometricsEnabled,
  saveLastOnlineValidation,
  getLastOnlineValidation,
  clearAllAuthData,
} from '../lib/auth/storage';
import {
  verifyTokenOffline,
  isTokenExpired,
  getTokenRemainingSeconds,
} from '../lib/auth/offline-verify';
import { loginWithCredentials, logoutFromServer } from '../lib/auth/api';
import type { JWTPayload, AuthState } from '../lib/auth/types';
import { AUTH_TIMING } from '../constants/auth';

// ============================================
// TYPES
// ============================================

/**
 * Extended auth state with actions for the Zustand store
 */
interface AuthStoreState extends AuthState {
  // Additional derived state
  tokenRemainingSeconds: number;

  // Actions - State setters
  setUser: (user: JWTPayload | null) => void;
  setOffline: (offline: boolean) => void;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;

  // Actions - Login methods
  /**
   * Login with email and password.
   * This is the PRIMARY login method called from the login screen.
   * Calls the API to get a token, verifies it, and stores it.
   */
  loginWithEmailPassword: (email: string, password: string) => Promise<{
    success: boolean;
    mustChangePassword?: boolean;
    error?: string;
  }>;

  /**
   * Login with a pre-obtained token.
   * Used for deep link SSO callbacks (ranz://auth/callback?token=xxx)
   * Verifies the token and stores it.
   */
  loginWithToken: (token: string) => Promise<boolean>;

  // Actions - Logout
  logout: () => Promise<void>;

  // Actions - Session management
  validateSession: () => Promise<boolean>;
  checkOfflineAuth: () => Promise<boolean>;
  initialize: () => Promise<void>;

  // Actions - Token utilities
  getTokenRemainingTime: () => Promise<number>;
}

// ============================================
// SECURE STORAGE ADAPTER
// ============================================

/**
 * Custom storage adapter for Zustand persist middleware.
 * Uses SecureStore for storing non-sensitive state like biometrics preference.
 *
 * Note: The actual token is stored separately via storage.ts with
 * stricter security settings (WHEN_UNLOCKED_THIS_DEVICE_ONLY).
 */
const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.warn('[AuthStore] Failed to persist state:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Ignore errors on removal
    }
  },
};

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      // ========================================
      // INITIAL STATE
      // ========================================
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isOffline: false,
      biometricsEnabled: false,
      lastOnlineValidation: null,
      tokenRemainingSeconds: 0,

      // ========================================
      // STATE SETTERS
      // ========================================

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setOffline: (offline) => set({ isOffline: offline }),

      setBiometricsEnabled: async (enabled) => {
        await saveBiometricsEnabled(enabled);
        set({ biometricsEnabled: enabled });
      },

      // ========================================
      // LOGIN METHODS
      // ========================================

      loginWithEmailPassword: async (email, password) => {
        // NOTE: Do NOT set isLoading here. The global isLoading controls
        // AuthGuard's loading spinner which would unmount the login screen,
        // losing form state and error messages. The login screen has its
        // own local isLoading state for button/UI feedback.

        try {
          // Call API to get token
          const response = await loginWithCredentials(email, password);

          if (!response.success || !response.token) {
            return {
              success: false,
              error: response.error || 'Login failed',
            };
          }

          // Verify token signature and expiry
          const payload = await verifyTokenOffline(response.token);
          if (!payload) {
            return {
              success: false,
              error: 'Invalid token received',
            };
          }

          // Store token securely
          await saveToken(response.token);

          // Store session ID for revocation tracking
          if (payload.sessionId) {
            await saveSessionId(payload.sessionId);
          }

          // Save validation timestamp
          const now = Date.now();
          await saveLastOnlineValidation(now);

          // Update state — setting isAuthenticated triggers AuthGuard redirect
          set({
            user: payload,
            isAuthenticated: true,
            lastOnlineValidation: now,
            tokenRemainingSeconds: getTokenRemainingSeconds(response.token),
          });

          return {
            success: true,
            mustChangePassword: response.mustChangePassword,
          };
        } catch (error) {
          console.error('[AuthStore] Login failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Login failed',
          };
        }
      },

      loginWithToken: async (token) => {
        // NOTE: Do NOT set isLoading here — same reason as loginWithEmailPassword.

        try {
          // Verify token signature and expiry
          const payload = await verifyTokenOffline(token);
          if (!payload) {
            return false;
          }

          // Store token securely
          await saveToken(token);

          // Store session ID for revocation tracking
          if (payload.sessionId) {
            await saveSessionId(payload.sessionId);
          }

          // Save validation timestamp
          const now = Date.now();
          await saveLastOnlineValidation(now);

          // Update state
          set({
            user: payload,
            isAuthenticated: true,
            lastOnlineValidation: now,
            tokenRemainingSeconds: getTokenRemainingSeconds(token),
          });

          return true;
        } catch (error) {
          console.error('[AuthStore] Token login failed:', error);
          return false;
        }
      },

      // ========================================
      // LOGOUT
      // ========================================

      logout: async () => {
        // Fire-and-forget server logout (don't block on it)
        logoutFromServer().catch(() => {
          // Ignore errors - we always logout locally
        });

        // Clear all stored auth data
        await clearAllAuthData();

        // Reset state
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          lastOnlineValidation: null,
          tokenRemainingSeconds: 0,
        });
      },

      // ========================================
      // SESSION MANAGEMENT
      // ========================================

      validateSession: async () => {
        const token = await getToken();

        if (!token) {
          set({ isAuthenticated: false, user: null, isLoading: false });
          return false;
        }

        // Quick expiry check first (no crypto)
        if (isTokenExpired(token)) {
          await get().logout();
          return false;
        }

        // Full signature verification
        const payload = await verifyTokenOffline(token);
        if (!payload) {
          await get().logout();
          return false;
        }

        // Update state with validated user
        set({
          user: payload,
          isAuthenticated: true,
          isLoading: false,
          tokenRemainingSeconds: getTokenRemainingSeconds(token),
        });

        return true;
      },

      checkOfflineAuth: async () => {
        const token = await getToken();
        if (!token) return false;

        // Verify token is valid
        const payload = await verifyTokenOffline(token);
        if (!payload) return false;

        // Check if token expires within grace period (30 minutes)
        // This allows offline work even when token is close to expiry
        const remaining = getTokenRemainingSeconds(token);
        const gracePeriodSeconds = AUTH_TIMING.OFFLINE_GRACE_PERIOD_MS / 1000;

        // Token must have at least grace period remaining for offline work
        return remaining > gracePeriodSeconds;
      },

      initialize: async () => {
        set({ isLoading: true });

        try {
          // Race initialization against a timeout to prevent infinite spinner
          const initWork = async () => {
            // Load persisted biometrics preference
            const biometricsEnabled = await getBiometricsEnabled();
            const lastOnlineValidation = await getLastOnlineValidation();

            set({ biometricsEnabled, lastOnlineValidation });

            // Try to validate existing session
            await get().validateSession();
          };

          await Promise.race([
            initWork(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Auth init timeout')), 10_000)
            ),
          ]);
        } catch (error) {
          console.error('[AuthStore] Initialization failed:', error);
          set({
            user: null,
            isAuthenticated: false,
          });
        } finally {
          // Always clear loading — even if init hangs or times out
          set({ isLoading: false });
        }
      },

      // ========================================
      // TOKEN UTILITIES
      // ========================================

      getTokenRemainingTime: async () => {
        const token = await getToken();
        if (!token) return 0;
        return getTokenRemainingSeconds(token);
      },
    }),
    {
      name: 'ranz-auth-state',
      storage: createJSONStorage(() => secureStorage),
      // Only persist non-sensitive state
      // Token is stored separately via storage.ts with stricter security
      partialize: (state) => ({
        biometricsEnabled: state.biometricsEnabled,
        lastOnlineValidation: state.lastOnlineValidation,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

/**
 * Selector for checking if user is authenticated
 */
export const selectIsAuthenticated = (state: AuthStoreState) => state.isAuthenticated;

/**
 * Selector for user info
 */
export const selectUser = (state: AuthStoreState) => state.user;

/**
 * Selector for loading state
 */
export const selectIsLoading = (state: AuthStoreState) => state.isLoading;

/**
 * Selector for offline status
 */
export const selectIsOffline = (state: AuthStoreState) => state.isOffline;

/**
 * Selector for biometrics enabled
 */
export const selectBiometricsEnabled = (state: AuthStoreState) => state.biometricsEnabled;
