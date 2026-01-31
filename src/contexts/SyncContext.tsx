/**
 * SyncContext
 * Provides sync state and notifications across the app
 * Manages conflict resolution modal state
 */

import React, { createContext, useContext, useEffect, useCallback, useState } from "react";
import { ToastContainer, useToast, type ToastMessage } from "../components/SyncToast";
import { ConflictResolutionModal } from "../components/ConflictResolutionModal";
import {
  onSyncError,
  onSyncConflict,
  onSyncComplete,
} from "../services/sync-service";
import type { SyncResult, SyncError, SyncConflict, ConflictResolution, EntityType } from "../types/sync";

interface SyncContextValue {
  // Toast methods
  showToast: (toast: Omit<ToastMessage, "id">) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  showConflict: (conflictCount: number) => string;

  // Sync notifications
  notifySyncComplete: (result: SyncResult) => void;
  notifySyncError: (error: SyncError) => void;

  // Conflict resolution
  pendingConflicts: SyncConflict[];
  showConflictModal: boolean;
  resolveConflicts: (resolutions: Array<{ entityId: string; resolution: ConflictResolution }>) => void;
  openConflictModal: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSyncContext must be used within a SyncProvider");
  }
  return context;
}

interface SyncProviderProps {
  children: React.ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const {
    toasts,
    showToast,
    dismissToast,
    success,
    error,
    warning,
    info,
    conflict,
  } = useToast();

  // Conflict resolution state
  const [pendingConflicts, setPendingConflicts] = useState<SyncConflict[]>([]);
  const [showConflictModalState, setShowConflictModalState] = useState(false);

  // Show conflict notification
  const showConflict = useCallback(
    (conflictCount: number) => {
      return conflict(conflictCount);
    },
    [conflict]
  );

  // Notify sync complete with summary
  const notifySyncComplete = useCallback(
    (result: SyncResult) => {
      if (!result.success) {
        const errorCount = result.errors.length;
        error(
          "Sync completed with errors",
          `${errorCount} item${errorCount !== 1 ? "s" : ""} failed to sync`
        );
        return;
      }

      // Check for conflicts
      const totalSynced =
        result.uploaded.reports +
        result.uploaded.photos +
        result.downloaded.reports;

      if (totalSynced > 0) {
        success(
          "Sync complete",
          `${result.uploaded.reports} reports, ${result.uploaded.photos} photos uploaded`
        );
      }
    },
    [success, error]
  );

  // Notify sync error
  const notifySyncError = useCallback(
    (syncError: SyncError) => {
      error("Sync failed", syncError.message);
    },
    [error]
  );

  // Handle conflict resolution
  const handleResolveConflicts = useCallback(
    (resolutions: Array<{ entityId: string; resolution: ConflictResolution }>) => {
      // TODO: Send resolutions to sync engine and re-sync
      console.log("[SyncContext] Resolving conflicts:", resolutions);
      setPendingConflicts([]);
      setShowConflictModalState(false);
      success("Conflicts Resolved", `${resolutions.length} conflict(s) resolved`);
    },
    [success]
  );

  // Dismiss conflict modal
  const handleDismissConflicts = useCallback(() => {
    setShowConflictModalState(false);
    // Keep pendingConflicts so user can return
    warning("Conflicts Pending", "You can resolve conflicts from the sync status");
  }, [warning]);

  // Open conflict modal (for manual access)
  const openConflictModal = useCallback(() => {
    if (pendingConflicts.length > 0) {
      setShowConflictModalState(true);
    }
  }, [pendingConflicts.length]);

  // Subscribe to sync events
  useEffect(() => {
    const handleSyncError = (err: SyncError) => {
      // Only show notification for non-retryable errors
      if (!err.retryable) {
        notifySyncError(err);
      }
    };

    const handleConflict = (conflicts: Array<{ reportId: string; resolution: string }>) => {
      if (conflicts.length > 0) {
        // Transform server conflict format to SyncConflict
        const syncConflicts: SyncConflict[] = conflicts.map((c) => ({
          entityType: "report" as EntityType,
          entityId: c.reportId,
          localVersion: {},
          serverVersion: {},
          localUpdatedAt: new Date().toISOString(), // Will be enriched by sync engine in future
          serverUpdatedAt: new Date().toISOString(),
        }));
        setPendingConflicts(syncConflicts);
        setShowConflictModalState(true);
      }
    };

    const handleSyncComplete = (result: SyncResult) => {
      notifySyncComplete(result);
    };

    // Register callbacks
    onSyncError(handleSyncError);
    onSyncConflict(handleConflict);
    onSyncComplete(handleSyncComplete);

    // Note: We can't unsubscribe from these callbacks in the current implementation
    // This is a known limitation - the callbacks remain registered

    return () => {
      // Cleanup if needed
    };
  }, [notifySyncError, showConflict, notifySyncComplete]);

  const contextValue: SyncContextValue = {
    showToast,
    success,
    error,
    warning,
    info,
    showConflict,
    notifySyncComplete,
    notifySyncError,
    pendingConflicts,
    showConflictModal: showConflictModalState,
    resolveConflicts: handleResolveConflicts,
    openConflictModal,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConflictResolutionModal
        visible={showConflictModalState}
        conflicts={pendingConflicts}
        onResolve={handleResolveConflicts}
        onDismiss={handleDismissConflicts}
      />
    </SyncContext.Provider>
  );
}

export default SyncProvider;
