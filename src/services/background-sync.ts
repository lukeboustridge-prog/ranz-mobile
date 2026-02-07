/**
 * Background Sync Service
 * Uses expo-background-task and expo-task-manager to sync data
 * when the app is in the background or closed
 *
 * Migrated from expo-background-fetch to expo-background-task (SDK 54+)
 * expo-background-task uses WorkManager on Android and BGTaskScheduler on iOS
 */

import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { checkApiHealth } from "../lib/api";
import {
  getPendingSyncReports,
  updateSyncState as updateDbSyncState,
} from "../lib/sqlite";

// ============================================
// CONSTANTS
// ============================================

export const BACKGROUND_SYNC_TASK = "ranz-background-sync";
export const BACKGROUND_PHOTO_UPLOAD_TASK = "ranz-photo-upload";

// Minimum interval between background tasks (in minutes)
// iOS enforces a minimum of 15 minutes; expo-background-task uses minutes
const MINIMUM_INTERVAL_MINUTES = 15;

// ============================================
// TYPES
// ============================================

export interface BackgroundSyncStatus {
  isRegistered: boolean;
  status: BackgroundTask.BackgroundTaskStatus | null;
  lastRunAt: string | null;
  lastResult: "success" | "failed" | "no_data" | null;
}

interface BackgroundSyncLog {
  timestamp: string;
  action: string;
  result: string;
  details?: Record<string, unknown>;
}

// In-memory log for debugging (cleared on app restart)
const syncLogs: BackgroundSyncLog[] = [];
const MAX_LOG_ENTRIES = 50;

// ============================================
// TASK DEFINITION
// ============================================

/**
 * Define the background sync task
 * IMPORTANT: This must be called at the top level of your entry file (e.g., app/_layout.tsx)
 * before any component renders
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  const startTime = Date.now();

  try {
    logSync("task_started", "Background sync task started");

    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) {
      logSync("skipped", "No network connection");
      return BackgroundTask.BackgroundTaskResult.Success; // Nothing to do, task completed OK
    }

    // Check if server is reachable
    const isOnline = await checkApiHealth();
    if (!isOnline) {
      logSync("skipped", "Server not reachable");
      return BackgroundTask.BackgroundTaskResult.Success; // Nothing to do, task completed OK
    }

    // Check if there's pending data to sync
    const pendingReports = await getPendingSyncReports();
    if (pendingReports.length === 0) {
      logSync("no_data", "No pending data to sync");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    logSync("syncing", `Found ${pendingReports.length} pending reports`);

    // Import sync engine dynamically to avoid circular dependencies
    const { syncPendingChanges } = await import("./sync-service");

    // Perform sync
    const result = await syncPendingChanges();

    // Update database with last background sync time
    await updateDbSyncState({
      lastUploadAt: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      logSync("success", `Synced ${result.reportsSynced} reports, ${result.photosSynced} photos`, {
        duration,
        reportsSynced: result.reportsSynced,
        photosSynced: result.photosSynced,
      });
      return BackgroundTask.BackgroundTaskResult.Success;
    } else {
      logSync("failed", `Sync failed with ${result.errors.length} errors`, {
        duration,
        errors: result.errors.map((e) => e.message),
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logSync("error", `Task error: ${errorMessage}`);
    console.error("[BackgroundSync] Task error:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ============================================
// REGISTRATION
// ============================================

/**
 * Register the background sync task
 * Call this after the app has initialized (e.g., in a useEffect in your root component)
 */
export async function registerBackgroundSync(): Promise<boolean> {
  try {
    // Check if background task is available
    const status = await BackgroundTask.getStatusAsync();

    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn("[BackgroundSync] Background task is restricted by the system");
      return false;
    }

    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      console.log("[BackgroundSync] Task already registered");
      return true;
    }

    // Register the task
    // Note: expo-background-task uses minimumInterval in minutes, not seconds
    // Android WorkManager and iOS BGTaskScheduler handle the scheduling internally
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: MINIMUM_INTERVAL_MINUTES,
    });

    console.log("[BackgroundSync] Task registered successfully");
    logSync("registered", "Background sync task registered", {
      minimumInterval: MINIMUM_INTERVAL_MINUTES,
    });

    return true;
  } catch (error) {
    console.error("[BackgroundSync] Failed to register task:", error);
    logSync("registration_error", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}

/**
 * Unregister the background sync task
 */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log("[BackgroundSync] Task unregistered");
      logSync("unregistered", "Background sync task unregistered");
    }
  } catch (error) {
    console.error("[BackgroundSync] Failed to unregister task:", error);
  }
}

// ============================================
// STATUS & DEBUGGING
// ============================================

/**
 * Get the current status of background sync
 */
export async function getBackgroundSyncStatus(): Promise<BackgroundSyncStatus> {
  try {
    const [status, isRegistered] = await Promise.all([
      BackgroundTask.getStatusAsync(),
      TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK),
    ]);

    // Get last log entry for last run info
    const lastSuccessLog = syncLogs.find(
      (log) => log.action === "success" || log.action === "no_data" || log.action === "failed"
    );

    return {
      isRegistered,
      status,
      lastRunAt: lastSuccessLog?.timestamp || null,
      lastResult: lastSuccessLog?.action === "success"
        ? "success"
        : lastSuccessLog?.action === "no_data"
        ? "no_data"
        : lastSuccessLog?.action === "failed"
        ? "failed"
        : null,
    };
  } catch (error) {
    console.error("[BackgroundSync] Failed to get status:", error);
    return {
      isRegistered: false,
      status: null,
      lastRunAt: null,
      lastResult: null,
    };
  }
}

/**
 * Get human-readable status string
 */
export function getStatusString(status: BackgroundTask.BackgroundTaskStatus | null): string {
  switch (status) {
    case BackgroundTask.BackgroundTaskStatus.Available:
      return "Available";
    case BackgroundTask.BackgroundTaskStatus.Restricted:
      return "Restricted by system";
    default:
      return "Unknown";
  }
}

/**
 * Get sync logs for debugging
 */
export function getSyncLogs(): BackgroundSyncLog[] {
  return [...syncLogs];
}

/**
 * Clear sync logs
 */
export function clearSyncLogs(): void {
  syncLogs.length = 0;
}

// ============================================
// MANUAL TRIGGER (for testing)
// ============================================

/**
 * Manually trigger a background sync (for testing purposes)
 * This directly executes the sync logic that would run in the background task
 */
export async function triggerBackgroundSync(): Promise<BackgroundTask.BackgroundTaskResult> {
  console.log("[BackgroundSync] Manual trigger requested");

  const startTime = Date.now();

  try {
    logSync("manual_trigger", "Manual sync triggered");

    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) {
      logSync("skipped", "No network connection");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Check if server is reachable
    const isOnline = await checkApiHealth();
    if (!isOnline) {
      logSync("skipped", "Server not reachable");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Check if there's pending data to sync
    const pendingReports = await getPendingSyncReports();
    if (pendingReports.length === 0) {
      logSync("no_data", "No pending data to sync");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    logSync("syncing", `Found ${pendingReports.length} pending reports`);

    // Import sync engine dynamically to avoid circular dependencies
    const { syncPendingChanges } = await import("./sync-service");

    // Perform sync
    const result = await syncPendingChanges();

    // Update database with last sync time
    await updateDbSyncState({
      lastUploadAt: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      logSync("success", `Synced ${result.reportsSynced} reports, ${result.photosSynced} photos`, {
        duration,
        reportsSynced: result.reportsSynced,
        photosSynced: result.photosSynced,
      });
      return BackgroundTask.BackgroundTaskResult.Success;
    } else {
      logSync("failed", `Sync failed with ${result.errors.length} errors`, {
        duration,
        errors: result.errors.map((e) => e.message),
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logSync("error", `Manual trigger error: ${errorMessage}`);
    console.error("[BackgroundSync] Manual trigger failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Log sync event (for debugging)
 */
function logSync(action: string, result: string, details?: Record<string, unknown>): void {
  const entry: BackgroundSyncLog = {
    timestamp: new Date().toISOString(),
    action,
    result,
    details,
  };

  // Add to beginning of array
  syncLogs.unshift(entry);

  // Keep only the most recent entries
  if (syncLogs.length > MAX_LOG_ENTRIES) {
    syncLogs.pop();
  }

  console.log(`[BackgroundSync] ${action}: ${result}`, details || "");
}

/**
 * Check if background sync is available on this device
 */
export async function isBackgroundSyncAvailable(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    return status === BackgroundTask.BackgroundTaskStatus.Available;
  } catch {
    return false;
  }
}

/**
 * Request background refresh permission (iOS specific)
 * On Android, this is typically always available
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    // Android doesn't require explicit permission for background task
    return true;
  }

  try {
    // On iOS, the status reflects whether the user has enabled background refresh
    const status = await BackgroundTask.getStatusAsync();
    return status === BackgroundTask.BackgroundTaskStatus.Available;
  } catch {
    return false;
  }
}

/**
 * Trigger background task for testing (only works in debug builds)
 * Uses expo-background-task's built-in test trigger
 */
export async function triggerTestTask(): Promise<boolean> {
  try {
    return await BackgroundTask.triggerTaskWorkerForTestingAsync();
  } catch (error) {
    console.error("[BackgroundSync] Failed to trigger test task:", error);
    return false;
  }
}
