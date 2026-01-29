/**
 * Auth Store - Stub
 *
 * This is a minimal stub for the auth store to support deep-linking module.
 * The full implementation will be completed in Plan 07-04 (Auth Store and Providers).
 *
 * This stub provides:
 * - loginWithToken: For SSO callback handling (deep-linking)
 *
 * TODO (07-04): Implement full auth store with:
 * - User state management
 * - Offline verification
 * - Session validation
 * - Biometric unlock state
 */

import { create } from 'zustand';
import type { JWTPayload, AuthState } from '../lib/auth/types';
import { saveToken, deleteToken, getToken } from '../lib/auth/storage';

// Stub interface - will be expanded in 07-04
interface AuthStoreState {
  // State
  user: JWTPayload | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

/**
 * Auth store with Zustand
 *
 * Note: This is a stub implementation. Full implementation in 07-04.
 */
export const useAuthStore = create<AuthStoreState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Login with a pre-obtained JWT token
   *
   * Used by deep-linking module for SSO callbacks where the token
   * is passed via URL parameter (ranz://auth/callback?token=xxx)
   *
   * @param token - JWT token received from SSO callback
   * @returns true if login succeeded, false if token invalid
   */
  loginWithToken: async (token: string) => {
    try {
      set({ isLoading: true });

      // Basic token structure validation
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('[AuthStore] Invalid token format');
        set({ isLoading: false });
        return false;
      }

      // Decode payload (without verification - stub)
      // Full verification will use offline-verify module in 07-04
      try {
        const payloadB64 = parts[1];
        const payloadJson = atob(payloadB64);
        const payload = JSON.parse(payloadJson) as JWTPayload;

        // Check basic required fields
        if (!payload.sub || !payload.email) {
          console.error('[AuthStore] Token missing required claims');
          set({ isLoading: false });
          return false;
        }

        // Check expiration
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          console.error('[AuthStore] Token expired');
          set({ isLoading: false });
          return false;
        }

        // Save token securely
        await saveToken(token);

        // Update state
        set({
          user: payload,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      } catch (parseError) {
        console.error('[AuthStore] Failed to parse token:', parseError);
        set({ isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('[AuthStore] loginWithToken error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  /**
   * Logout and clear auth state
   */
  logout: async () => {
    await deleteToken();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
