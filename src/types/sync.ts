/**
 * Sync Protocol Types
 * Types for offline sync engine
 */

import type { Checklist, ReportTemplate, ReportSummary, User } from "./shared";

// ============================================
// SYNC ENGINE TYPES
// ============================================

export interface SyncProgress {
  status: string;
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

export interface SyncResult {
  success: boolean;
  downloaded: {
    checklists: number;
    templates: number;
    reports: number;
  };
  uploaded: {
    reports: number;
    photos: number;
    defects: number;
    elements: number;
  };
  errors: SyncError[];
  duration: number; // milliseconds
  timestamp: string;
}

export interface SyncError {
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
  retryable: boolean;
}

export interface BootstrapData {
  user: User;
  checklists: Checklist[];
  templates: ReportTemplate[];
  recentReports: ReportSummary[];
  lastSyncAt: string;
}

// ============================================
// SYNC QUEUE OPERATIONS
// ============================================

export type EntityType = "report" | "photo" | "defect" | "element" | "compliance";
export type OperationType = "create" | "update" | "delete";

export interface QueuedOperation {
  id: number;
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

export type ConflictResolution = "keep_local" | "keep_server" | "merge";

export interface SyncConflict {
  entityType: EntityType;
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  localUpdatedAt: string;
  serverUpdatedAt: string;
}

// ============================================
// SYNC STATE
// ============================================

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingUploads: number;
  pendingDownloads: number;
  lastError: SyncError | null;
}

// ============================================
// NETWORK STATUS
// ============================================

export interface NetworkStatus {
  isConnected: boolean;
  type: "wifi" | "cellular" | "unknown" | "none";
  isInternetReachable: boolean | null;
}
