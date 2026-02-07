/**
 * useSyncEngine Hook
 * Provides sync state and triggers sync operations
 * Includes conflict management and retry functionality
 */

import { useState, useEffect, useCallback } from "react";
import {
  syncEngine,
  initializeSyncEngine,
  getSyncState,
  retryFailedSyncs,
} from "../services/sync-service";
import { getFailedSyncCount, resetFailedItems } from "../lib/sqlite";
import { useNetworkStatus } from "./useNetworkStatus";
import type { SyncState, SyncResult, SyncProgress } from "../types/sync";
import type { SyncConflict, ConflictResolution } from "../components/ConflictModal";

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

  // Conflict management state
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Failed items state
  const [failedCount, setFailedCount] = useState(0);

  const { isConnected, wasOffline, clearWasOffline } = useNetworkStatus();

  // Load failed count helper
  const loadFailedCount = useCallback(async () => {
    try {
      const count = await getFailedSyncCount();
      setFailedCount(count);
    } catch (error) {
      console.error("[Sync] Failed to load failed count:", error);
    }
  }, []);

  // Load initial sync state and failed count
  const loadSyncState = useCallback(async () => {
    try {
      const state = await getSyncState();
      setSyncState(state);
      await loadFailedCount();
    } catch (error) {
      console.error("[Sync] Failed to load sync state:", error);
    }
  }, [loadFailedCount]);

  // Initial load
  useEffect(() => {
    loadSyncState();
  }, [loadSyncState]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (wasOffline && isConnected) {
      console.log("[Sync] Back online - triggering sync");
      sync();
      clearWasOffline();
    }
  }, [wasOffline, isConnected]);

  // Register progress and conflict callbacks
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

    // Register conflict callback
    syncEngine.onConflict((serverConflicts) => {
      // Transform server conflicts to our format
      const formatted: SyncConflict[] = serverConflicts.map((c) => ({
        reportId: c.reportId,
        reportNumber: "", // Will be populated from report data if available
        resolution: c.resolution as "client_wins" | "server_wins" | "pending",
        serverUpdatedAt:
          (c as Record<string, unknown>).serverUpdatedAt as string ||
          new Date().toISOString(),
        clientUpdatedAt:
          (c as Record<string, unknown>).clientUpdatedAt as string ||
          new Date().toISOString(),
      }));
      setConflicts(formatted);
      if (formatted.length > 0) {
        setShowConflictModal(true);
      }
    });
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
        errors: [
          {
            code: "SYNC_ERROR",
            message: error instanceof Error ? error.message : "Unknown sync error",
            retryable: true,
          },
        ],
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

  // Retry failed syncs
  const retryFailed = useCallback(async () => {
    try {
      // Reset failed items in database
      await resetFailedItems();

      // Trigger sync via retryFailedSyncs
      const result = await retryFailedSyncs();
      setLastResult(result);

      // Reload counts
      await loadSyncState();
    } catch (error) {
      console.error("[Sync] Retry failed:", error);
    }
  }, [loadSyncState]);

  // Conflict resolution handlers
  const resolveConflict = useCallback(
    (reportId: string, resolution: ConflictResolution) => {
      // Remove from conflicts list
      setConflicts((prev) => prev.filter((c) => c.reportId !== reportId));

      // TODO: Send resolution to server in future phase
      console.log(`[Sync] Conflict resolved for ${reportId}: ${resolution}`);

      // Close modal if no more conflicts
      setConflicts((currentConflicts) => {
        if (currentConflicts.length === 0) {
          setShowConflictModal(false);
        }
        return currentConflicts;
      });
    },
    []
  );

  const dismissConflicts = useCallback(() => {
    setShowConflictModal(false);
  }, []);

  return {
    syncState: {
      ...syncState,
      isOnline: isConnected,
    },
    progress,
    lastResult,
    sync,
    refresh: loadSyncState,
    // Conflict management
    conflicts,
    showConflictModal,
    resolveConflict,
    dismissConflicts,
    // Failed items
    failedCount,
    retryFailed,
  };
}

export default useSyncEngine;
