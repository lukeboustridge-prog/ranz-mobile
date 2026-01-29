/**
 * useAuth Hook
 *
 * Convenience hook for accessing authentication state and actions.
 * Wraps the Zustand auth store with network monitoring.
 *
 * Features:
 * - Monitors network connectivity and updates store
 * - Exposes common auth state and actions
 * - Handles offline detection for UI indicators
 */

import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../stores/auth-store';

/**
 * Hook for authentication state and actions
 *
 * @example
 * function MyComponent() {
 *   const { user, isAuthenticated, isOffline, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return (
 *     <View>
 *       {isOffline && <OfflineBanner />}
 *       <Text>Welcome, {user?.name}</Text>
 *     </View>
 *   );
 * }
 */
export function useAuth() {
  const store = useAuthStore();

  // Monitor network status and update store
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      store.setOffline(!state.isConnected);
    });

    // Check initial network state
    NetInfo.fetch().then((state) => {
      store.setOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return {
    // State
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isOffline: store.isOffline,
    biometricsEnabled: store.biometricsEnabled,
    tokenRemainingSeconds: store.tokenRemainingSeconds,

    // Login methods
    loginWithEmailPassword: store.loginWithEmailPassword,
    loginWithToken: store.loginWithToken,

    // Logout
    logout: store.logout,

    // Session management
    validateSession: store.validateSession,
    checkOfflineAuth: store.checkOfflineAuth,
    initialize: store.initialize,

    // Preferences
    setBiometricsEnabled: store.setBiometricsEnabled,

    // Utilities
    getTokenRemainingTime: store.getTokenRemainingTime,
  };
}
