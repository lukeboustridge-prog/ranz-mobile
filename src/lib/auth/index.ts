/**
 * Auth Module
 *
 * Central export for all authentication utilities.
 * Import from this module for cleaner imports throughout the app.
 *
 * @example
 * import { useAuthStore, verifyTokenOffline, saveToken } from '@/lib/auth';
 */

// Types
export * from './types';

// Secure storage
export {
  saveToken,
  getToken,
  deleteToken,
  saveSessionId,
  getSessionId,
  deleteSessionId,
  saveBiometricsEnabled,
  getBiometricsEnabled,
  deleteBiometricsEnabled,
  saveLastOnlineValidation,
  getLastOnlineValidation,
  deleteLastOnlineValidation,
  clearAllAuthData,
  getAuthStorageInfo,
  isSecureStorageAvailable,
} from './storage';

// Offline JWT verification
export {
  verifyTokenOffline,
  isTokenExpired,
  getTokenRemainingSeconds,
  decodeTokenUnsafe,
  clearKeyCache,
} from './offline-verify';

// API client
export {
  loginWithCredentials,
  logoutFromServer,
  validateSessionOnline,
  refreshToken,
  type LoginResponse,
  type SessionValidationResponse,
} from './api';

// Auth store - re-export from stores directory
export { useAuthStore } from '../../stores/auth-store';
