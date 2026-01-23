/**
 * useSyncStatus Hook
 * React hook for monitoring sync status and controlling sync operations
 */

import { useState, useEffect, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import type { SyncState, SyncResult } from "../types/sync";
import {
  getSyncState,
  fullSync,
  syncPendingChanges,
  retryFailedSyncs,
  onSyncProgress,
  onSyncStatusChange,
} from "../services/sync-service";
import {
  getBackgroundSyncStatus,
  triggerBackgroundSync,
  getStatusString,
  getSyncLogs,
  isBackgroundSyncAvailable,
  type BackgroundSyncStatus,
} from "../services/background-sync";

// ============================================
// TYPES
// ============================================

export interface SyncStatusHook {
  // Current state
  syncState: SyncState | null;
  backgroundStatus: BackgroundSyncStatus | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Progress tracking
  progress: number;
  progressMessage: string;

  // Actions
  sync: () => Promise<SyncResult>;
  syncPending: () => Promise<void>;
  retryFailed: () => Promise<SyncResult>;
  triggerBackgroundSync: () => Promise<void>;
  refresh: () => Promise<void>;

  // Debug
  logs: ReturnType<typeof getSyncLogs>;
  backgroundStatusText: string;
}

// ============================================
// HOOK
// ============================================

export function useSyncStatus(): SyncStatusHook {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [logs, setLogs] = useState<ReturnType<typeof getSyncLogs>>([]);

  // Fetch current status
  const refresh = useCallback(async () => {
    try {
      const [state, bgStatus] = await Promise.all([
        getSyncState(),
        getBackgroundSyncStatus(),
      ]);
      setSyncState(state);
      setBackgroundStatus(bgStatus);
      setLogs(getSyncLogs());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get sync status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and app state handling
  useEffect(() => {
    refresh();

    // Refresh when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        refresh();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  // Subscribe to sync progress updates
  useEffect(() => {
    onSyncProgress((message, progressValue) => {
      setProgressMessage(message);
      setProgress(progressValue);
    });

    onSyncStatusChange((state) => {
      setSyncState(state);
      setIsSyncing(state.isSyncing);
    });
  }, []);

  // Full sync action
  const sync = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    setError(null);
    setProgress(0);
    setProgressMessage("Starting sync...");

    try {
      const result = await fullSync();

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0].message);
      }

      await refresh();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsSyncing(false);
      setProgress(100);
      setProgressMessage("");
    }
  }, [refresh]);

  // Sync pending changes only
  const syncPending = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    setError(null);

    try {
      const result = await syncPendingChanges();

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0].message);
      }

      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  // Retry failed syncs
  const retryFailed = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    setError(null);

    try {
      const result = await retryFailedSyncs();

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0].message);
      }

      await refresh();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Retry failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  // Manually trigger background sync
  const triggerBgSync = useCallback(async (): Promise<void> => {
    try {
      await triggerBackgroundSync();
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Background sync trigger failed";
      setError(errorMessage);
      throw err;
    }
  }, [refresh]);

  // Get background status text
  const backgroundStatusText = backgroundStatus
    ? getStatusString(backgroundStatus.status)
    : "Unknown";

  return {
    syncState,
    backgroundStatus,
    isLoading,
    isSyncing: isSyncing || (syncState?.isSyncing ?? false),
    error,
    progress,
    progressMessage,
    sync,
    syncPending,
    retryFailed,
    triggerBackgroundSync: triggerBgSync,
    refresh,
    logs,
    backgroundStatusText,
  };
}

// ============================================
// UTILITY HOOK
// ============================================

/**
 * Simple hook to check if background sync is available
 */
export function useBackgroundSyncAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isBackgroundSyncAvailable().then(setAvailable);
  }, []);

  return available;
}
