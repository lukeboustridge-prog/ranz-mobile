/**
 * useSyncEngine Hook
 * Provides sync state and triggers sync operations
 */

import { useState, useEffect, useCallback } from "react";
import { syncEngine, initializeSyncEngine, getSyncState } from "../services/sync-service";
import { useNetworkStatus } from "./useNetworkStatus";
import type { SyncState, SyncResult, SyncProgress } from "../types/sync";

export function useSyncEngine() {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: false,
    isSyncing: false,
    lastSyncAt: null,
    pendingUploads: 0,
    pendingDownloads: 0,
    lastError: null,
  });
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const { isConnected, wasOffline, clearWasOffline } = useNetworkStatus();

  // Load initial sync state
  useEffect(() => {
    loadSyncState();
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (wasOffline && isConnected) {
      console.log("[Sync] Back online - triggering sync");
      sync();
      clearWasOffline();
    }
  }, [wasOffline, isConnected]);

  // Register progress callback
  useEffect(() => {
    syncEngine.onProgress((status, progressPercent) => {
      setProgress({
        status,
        progress: progressPercent,
        currentStep: status,
        totalSteps: 5,
        completedSteps: Math.floor(progressPercent / 20),
      });
    });

    syncEngine.onError((error) => {
      setSyncState((prev) => ({
        ...prev,
        lastError: error,
      }));
    });
  }, []);

  const loadSyncState = useCallback(async () => {
    try {
      const state = await getSyncState();
      setSyncState(state);
    } catch (error) {
      console.error("[Sync] Failed to load sync state:", error);
    }
  }, []);

  const sync = useCallback(async (): Promise<SyncResult> => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    setProgress(null);

    try {
      const result = await initializeSyncEngine();
      setLastResult(result);

      // Reload sync state after sync
      await loadSyncState();

      return result;
    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        downloaded: { checklists: 0, templates: 0, reports: 0 },
        uploaded: { reports: 0, photos: 0, defects: 0, elements: 0 },
        errors: [{
          code: "SYNC_ERROR",
          message: error instanceof Error ? error.message : "Unknown sync error",
          retryable: true,
        }],
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
      setProgress(null);
    }
  }, [loadSyncState]);

  return {
    syncState: {
      ...syncState,
      isOnline: isConnected,
    },
    progress,
    lastResult,
    sync,
    refresh: loadSyncState,
  };
}

export default useSyncEngine;
