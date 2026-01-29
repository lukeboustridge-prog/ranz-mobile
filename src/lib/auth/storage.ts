/**
 * Secure Auth Storage
 *
 * Handles secure storage of authentication tokens using expo-secure-store
 * with WHEN_UNLOCKED_THIS_DEVICE_ONLY accessibility for maximum security.
 *
 * This is separate from src/lib/storage.ts (sync-related storage) to keep
 * auth storage isolated with its own stricter security settings.
 *
 * Security notes:
 * - WHEN_UNLOCKED_THIS_DEVICE_ONLY: Data only accessible while device unlocked
 * - Data NOT migrated during backup restore (more secure)
 * - Satisfies MOBL-02 requirement for secure token storage
 */

import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS, type StorageKey } from '../../constants/auth';

/**
 * Storage options with WHEN_UNLOCKED_THIS_DEVICE_ONLY accessibility
 *
 * This ensures:
 * - Data only accessible while device is unlocked
 * - Data NOT migrated during backup restore to new device
 * - Tokens tied to this specific device only
 */
const STORAGE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'ranz-mobile-auth',
};

// ============================================
// LOW-LEVEL HELPERS (internal use)
// ============================================

/**
 * Set item in secure storage with proper error handling
 */
async function setSecureItem(key: StorageKey, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value, STORAGE_OPTIONS);
    return true;
  } catch (error) {
    console.error(`[AuthStorage] Failed to save ${key}:`, error);
    return false;
  }
}

/**
 * Get item from secure storage with proper error handling
 */
async function getSecureItem(key: StorageKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, STORAGE_OPTIONS);
  } catch (error) {
    console.error(`[AuthStorage] Failed to get ${key}:`, error);
    return null;
  }
}

/**
 * Delete item from secure storage with proper error handling
 */
async function deleteSecureItem(key: StorageKey): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(key, STORAGE_OPTIONS);
    return true;
  } catch (error) {
    console.error(`[AuthStorage] Failed to delete ${key}:`, error);
    return false;
  }
}

// ============================================
// TOKEN STORAGE
// ============================================

/**
 * Save JWT auth token to secure storage
 */
export async function saveToken(token: string): Promise<void> {
  const success = await setSecureItem(STORAGE_KEYS.AUTH_TOKEN, token);
  if (!success) {
    console.warn('[AuthStorage] Token save failed - auth may not persist');
  }
}

/**
 * Get JWT auth token from secure storage
 */
export async function getToken(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Delete JWT auth token from secure storage
 */
export async function deleteToken(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.AUTH_TOKEN);
}

// ============================================
// SESSION ID STORAGE
// ============================================

/**
 * Save session ID for revocation tracking
 */
export async function saveSessionId(sessionId: string): Promise<void> {
  const success = await setSecureItem(STORAGE_KEYS.SESSION_ID, sessionId);
  if (!success) {
    console.warn('[AuthStorage] Session ID save failed');
  }
}

/**
 * Get stored session ID
 */
export async function getSessionId(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.SESSION_ID);
}

/**
 * Delete stored session ID
 */
export async function deleteSessionId(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.SESSION_ID);
}

// ============================================
// BIOMETRICS PREFERENCE STORAGE
// ============================================

/**
 * Save user preference for biometric authentication
 */
export async function saveBiometricsEnabled(enabled: boolean): Promise<void> {
  const success = await setSecureItem(
    STORAGE_KEYS.BIOMETRICS_ENABLED,
    enabled ? 'true' : 'false'
  );
  if (!success) {
    console.warn('[AuthStorage] Biometrics preference save failed');
  }
}

/**
 * Get user preference for biometric authentication
 * Defaults to false if not set
 */
export async function getBiometricsEnabled(): Promise<boolean> {
  const value = await getSecureItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
  return value === 'true';
}

/**
 * Delete biometrics preference
 */
export async function deleteBiometricsEnabled(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
}

// ============================================
// LAST ONLINE VALIDATION TIMESTAMP
// ============================================

/**
 * Save timestamp of last successful online token validation
 * Used to determine if cached auth is still trustworthy for offline use
 */
export async function saveLastOnlineValidation(timestamp: number): Promise<void> {
  const success = await setSecureItem(
    STORAGE_KEYS.LAST_ONLINE_VALIDATION,
    timestamp.toString()
  );
  if (!success) {
    console.warn('[AuthStorage] Last online validation save failed');
  }
}

/**
 * Get timestamp of last successful online token validation
 * Returns null if never validated or parse error
 */
export async function getLastOnlineValidation(): Promise<number | null> {
  const value = await getSecureItem(STORAGE_KEYS.LAST_ONLINE_VALIDATION);
  if (!value) return null;

  const timestamp = parseInt(value, 10);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * Delete last online validation timestamp
 */
export async function deleteLastOnlineValidation(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.LAST_ONLINE_VALIDATION);
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Clear all auth-related data from secure storage
 * Used during logout or account switch
 */
export async function clearAllAuthData(): Promise<void> {
  await Promise.all([
    deleteToken(),
    deleteSessionId(),
    deleteBiometricsEnabled(),
    deleteLastOnlineValidation(),
  ]);
}

/**
 * Get auth info summary for debugging
 * Does NOT return actual token values, only presence indicators
 */
export async function getAuthStorageInfo(): Promise<{
  hasToken: boolean;
  hasSessionId: boolean;
  biometricsEnabled: boolean;
  lastOnlineValidation: number | null;
}> {
  const [token, sessionId, biometricsEnabled, lastOnlineValidation] = await Promise.all([
    getToken(),
    getSessionId(),
    getBiometricsEnabled(),
    getLastOnlineValidation(),
  ]);

  return {
    hasToken: !!token,
    hasSessionId: !!sessionId,
    biometricsEnabled,
    lastOnlineValidation,
  };
}

/**
 * Check if secure storage is available and working
 * Some devices may have issues with secure storage
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    const testKey = 'ranz_auth_storage_test' as StorageKey;
    const testValue = 'test_' + Date.now();

    await SecureStore.setItemAsync(testKey, testValue, STORAGE_OPTIONS);
    const retrieved = await SecureStore.getItemAsync(testKey, STORAGE_OPTIONS);
    await SecureStore.deleteItemAsync(testKey, STORAGE_OPTIONS);

    return retrieved === testValue;
  } catch (error) {
    console.error('[AuthStorage] Secure storage availability check failed:', error);
    return false;
  }
}
