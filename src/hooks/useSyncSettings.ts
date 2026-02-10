/**
 * useSyncSettings Hook
 * Manages sync preferences and network-aware upload behavior
 */

import { useState, useEffect, useCallback } from "react";
import NetInfo, { NetInfoStateType } from "@react-native-community/netinfo";
import {
  getSyncSettings,
  saveSyncSettings,
  type SyncSettings,
} from "../lib/storage";

export interface SyncSettingsHook {
  settings: SyncSettings | null;
  isLoading: boolean;

  // Current network state
  isWifi: boolean;
  connectionType: NetInfoStateType | null;

  // Actions
  updateSettings: (updates: Partial<SyncSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  refresh: () => Promise<void>;

  // Utilities
  canUploadPhoto: (fileSizeBytes: number) => boolean;
  shouldQueueForWifi: (fileSizeBytes: number) => boolean;
}

export function useSyncSettings(): SyncSettingsHook {
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWifi, setIsWifi] = useState(false);
  const [connectionType, setConnectionType] = useState<NetInfoStateType | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Subscribe to network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsWifi(state.type === NetInfoStateType.wifi);
      setConnectionType(state.type);
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsWifi(state.type === NetInfoStateType.wifi);
      setConnectionType(state.type);
    });

    return () => unsubscribe();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const loaded = await getSyncSettings();
      setSettings(loaded);
    } catch (error) {
      console.error("[SyncSettings] Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = useCallback(async (updates: Partial<SyncSettings>) => {
    try {
      await saveSyncSettings(updates);
      setSettings((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (error) {
      console.error("[SyncSettings] Failed to save settings:", error);
      throw error;
    }
  }, []);

  const resetSettings = useCallback(async () => {
    try {
      const { resetSyncSettings, getSyncSettings: getSettings } = await import("../lib/storage");
      await resetSyncSettings();
      const fresh = await getSettings();
      setSettings(fresh);
    } catch (error) {
      console.error("[SyncSettings] Failed to reset settings:", error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadSettings();
  }, []);

  /**
   * Check if a photo can be uploaded based on current network and settings
   */
  const canUploadPhoto = useCallback(
    (fileSizeBytes: number): boolean => {
      if (!settings) return true; // Default to allowing if settings not loaded
      if (!settings.photosWifiOnly) return true; // WiFi-only disabled

      const fileSizeMb = fileSizeBytes / (1024 * 1024);

      // If below threshold, always allow
      if (fileSizeMb < settings.wifiOnlyThresholdMb) return true;

      // If above threshold, only allow on WiFi
      return isWifi;
    },
    [settings, isWifi]
  );

  /**
   * Check if a photo should be queued for WiFi upload
   */
  const shouldQueueForWifi = useCallback(
    (fileSizeBytes: number): boolean => {
      if (!settings) return false;
      if (!settings.photosWifiOnly) return false;

      const fileSizeMb = fileSizeBytes / (1024 * 1024);

      // Queue if above threshold and not on WiFi
      return fileSizeMb >= settings.wifiOnlyThresholdMb && !isWifi;
    },
    [settings, isWifi]
  );

  return {
    settings,
    isLoading,
    isWifi,
    connectionType,
    updateSettings,
    resetSettings,
    refresh,
    canUploadPhoto,
    shouldQueueForWifi,
  };
}

/**
 * Utility function to check if upload should proceed
 * Can be used outside of React components
 */
export async function checkCanUploadPhoto(fileSizeBytes: number): Promise<{
  canUpload: boolean;
  reason?: string;
}> {
  const [settings, netState] = await Promise.all([
    getSyncSettings(),
    NetInfo.fetch(),
  ]);

  if (!settings.photosWifiOnly) {
    return { canUpload: true };
  }

  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  const isWifi = netState.type === NetInfoStateType.wifi;

  if (fileSizeMb < settings.wifiOnlyThresholdMb) {
    return { canUpload: true };
  }

  if (!isWifi) {
    return {
      canUpload: false,
      reason: `File is ${fileSizeMb.toFixed(1)}MB. Photos over ${settings.wifiOnlyThresholdMb}MB will sync when on WiFi.`,
    };
  }

  return { canUpload: true };
}

export default useSyncSettings;
