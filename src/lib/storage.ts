/**
 * Secure Storage Manager
 * Handles secure token and credential storage using Expo SecureStore
 */

import * as SecureStore from "expo-secure-store";

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: "ranz_auth_token",
  REFRESH_TOKEN: "ranz_refresh_token",
  USER_ID: "ranz_user_id",
  LAST_SYNC_AT: "ranz_last_sync_at",
  DEVICE_ID: "ranz_device_id",
  SYNC_SETTINGS: "ranz_sync_settings",
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Save a value to secure storage
 */
async function setSecureItem(key: StorageKey, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`[SecureStore] Failed to save ${key}:`, error);
    throw error;
  }
}

/**
 * Get a value from secure storage
 */
async function getSecureItem(key: StorageKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`[SecureStore] Failed to get ${key}:`, error);
    return null;
  }
}

/**
 * Delete a value from secure storage
 */
async function deleteSecureItem(key: StorageKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`[SecureStore] Failed to delete ${key}:`, error);
  }
}

// ============================================
// AUTH TOKEN MANAGEMENT
// ============================================

export async function saveAuthToken(token: string): Promise<void> {
  await setSecureItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function getAuthToken(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.AUTH_TOKEN);
}

export async function deleteAuthToken(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.AUTH_TOKEN);
}

export async function saveRefreshToken(token: string): Promise<void> {
  await setSecureItem(STORAGE_KEYS.REFRESH_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function deleteRefreshToken(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// ============================================
// USER MANAGEMENT
// ============================================

export async function saveUserId(userId: string): Promise<void> {
  await setSecureItem(STORAGE_KEYS.USER_ID, userId);
}

export async function getUserId(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.USER_ID);
}

export async function deleteUserId(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.USER_ID);
}

// ============================================
// SYNC MANAGEMENT
// ============================================

export async function saveLastSyncAt(timestamp: string): Promise<void> {
  await setSecureItem(STORAGE_KEYS.LAST_SYNC_AT, timestamp);
}

export async function getLastSyncAt(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.LAST_SYNC_AT);
}

// ============================================
// SYNC SETTINGS
// ============================================

export interface SyncSettings {
  /** Only sync photos over WiFi (for large files) */
  photosWifiOnly: boolean;
  /** Size threshold in MB for WiFi-only uploads */
  wifiOnlyThresholdMb: number;
  /** Auto-sync when online */
  autoSyncEnabled: boolean;
  /** Background sync enabled */
  backgroundSyncEnabled: boolean;
}

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  photosWifiOnly: true,
  wifiOnlyThresholdMb: 5, // 5MB threshold
  autoSyncEnabled: true,
  backgroundSyncEnabled: true,
};

export async function getSyncSettings(): Promise<SyncSettings> {
  try {
    const stored = await getSecureItem(STORAGE_KEYS.SYNC_SETTINGS);
    if (stored) {
      return { ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(stored) };
    }
    return DEFAULT_SYNC_SETTINGS;
  } catch {
    return DEFAULT_SYNC_SETTINGS;
  }
}

export async function saveSyncSettings(settings: Partial<SyncSettings>): Promise<void> {
  const current = await getSyncSettings();
  const updated = { ...current, ...settings };
  await setSecureItem(STORAGE_KEYS.SYNC_SETTINGS, JSON.stringify(updated));
}

export async function resetSyncSettings(): Promise<void> {
  await setSecureItem(STORAGE_KEYS.SYNC_SETTINGS, JSON.stringify(DEFAULT_SYNC_SETTINGS));
}

// ============================================
// DEVICE ID MANAGEMENT
// ============================================

export async function saveDeviceId(deviceId: string): Promise<void> {
  await setSecureItem(STORAGE_KEYS.DEVICE_ID, deviceId);
}

export async function getDeviceId(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.DEVICE_ID);
}

/**
 * Generate and store a unique device ID if one doesn't exist
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await getDeviceId();

  if (!deviceId) {
    // Generate a random device ID
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    await saveDeviceId(deviceId);
  }

  return deviceId;
}

// ============================================
// CLEAR ALL AUTH DATA
// ============================================

export async function clearAllAuthData(): Promise<void> {
  await Promise.all([
    deleteAuthToken(),
    deleteRefreshToken(),
    deleteUserId(),
  ]);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if secure storage is available on this device
 */
export async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    const testKey = "ranz_test_key";
    const testValue = "test";
    await SecureStore.setItemAsync(testKey, testValue);
    const result = await SecureStore.getItemAsync(testKey);
    await SecureStore.deleteItemAsync(testKey);
    return result === testValue;
  } catch {
    return false;
  }
}

/**
 * Get all stored authentication info (for debugging)
 */
export async function getAuthInfo(): Promise<{
  hasAuthToken: boolean;
  hasRefreshToken: boolean;
  userId: string | null;
  lastSyncAt: string | null;
  deviceId: string | null;
}> {
  const [authToken, refreshToken, userId, lastSyncAt, deviceId] = await Promise.all([
    getAuthToken(),
    getRefreshToken(),
    getUserId(),
    getLastSyncAt(),
    getDeviceId(),
  ]);

  return {
    hasAuthToken: !!authToken,
    hasRefreshToken: !!refreshToken,
    userId,
    lastSyncAt,
    deviceId,
  };
}
