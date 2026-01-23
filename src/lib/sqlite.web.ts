/**
 * SQLite Web Stub
 * Provides empty implementations for web platform where SQLite is not available
 * Must match the API of sqlite.ts for type compatibility
 */

import type {
  LocalUser,
  LocalReport,
  LocalPhoto,
  LocalChecklist,
  LocalTemplate,
  LocalComplianceAssessment,
  LocalRoofElement,
  LocalDefect,
  LocalSyncQueue,
  LocalSyncState,
} from "../types/database";

// All functions return empty/null on web platform
console.log("[SQLite Web] Running in web mode - SQLite not available");

export async function initializeDatabase(): Promise<void> {
  console.log("[SQLite Web] Database not available on web platform");
}

export function getDatabase(): never {
  throw new Error("SQLite not available on web platform");
}

export async function closeDatabase(): Promise<void> {}

// Sync State
export async function getSyncState(): Promise<LocalSyncState | null> {
  return null;
}
export async function updateSyncState(_updates: Partial<Omit<LocalSyncState, "id" | "deviceId">>): Promise<void> {}

// User operations
export async function saveUser(_user: LocalUser): Promise<void> {}
export async function getUser(): Promise<LocalUser | null> {
  return null;
}
export async function clearUser(): Promise<void> {}

// Report operations
export async function saveReport(_report: LocalReport): Promise<void> {}
export async function getReport(_id: string): Promise<LocalReport | null> {
  return null;
}
export async function getAllReports(): Promise<LocalReport[]> {
  return [];
}
export async function getPendingSyncReports(): Promise<LocalReport[]> {
  return [];
}
export async function deleteReport(_id: string): Promise<void> {}

// Roof Element operations
export async function saveRoofElement(_element: LocalRoofElement): Promise<void> {}
export async function getRoofElementsForReport(_reportId: string): Promise<LocalRoofElement[]> {
  return [];
}
export async function deleteRoofElement(_id: string): Promise<void> {}

// Defect operations
export async function saveDefect(_defect: LocalDefect): Promise<void> {}
export async function getDefectsForReport(_reportId: string): Promise<LocalDefect[]> {
  return [];
}
export async function getNextDefectNumber(_reportId: string): Promise<number> {
  return 1;
}
export async function deleteDefect(_id: string): Promise<void> {}

// Photo operations
export async function savePhoto(_photo: LocalPhoto): Promise<void> {}
export async function getPhotosForReport(_reportId: string): Promise<LocalPhoto[]> {
  return [];
}
export async function getPhotosForDefect(_defectId: string): Promise<LocalPhoto[]> {
  return [];
}
export async function getPendingUploadPhotos(): Promise<LocalPhoto[]> {
  return [];
}
export async function updatePhotoSyncStatus(
  _id: string,
  _status: LocalPhoto["syncStatus"],
  _uploadedUrl?: string,
  _error?: string
): Promise<void> {}
export async function deletePhoto(_id: string): Promise<void> {}

// Compliance operations
export async function saveComplianceAssessment(_assessment: LocalComplianceAssessment): Promise<void> {}
export async function getComplianceAssessment(_reportId: string): Promise<LocalComplianceAssessment | null> {
  return null;
}
export async function deleteComplianceAssessment(_reportId: string): Promise<void> {}

// Checklist operations
export async function saveChecklist(_checklist: LocalChecklist): Promise<void> {}
export async function getAllChecklists(): Promise<LocalChecklist[]> {
  return [];
}
export async function getChecklistByStandard(_standard: string): Promise<LocalChecklist | null> {
  return null;
}

// Template operations
export async function saveTemplate(_template: LocalTemplate): Promise<void> {}
export async function getAllTemplates(): Promise<LocalTemplate[]> {
  return [];
}
export async function getDefaultTemplate(): Promise<LocalTemplate | null> {
  return null;
}

// Sync queue operations
export async function addToSyncQueue(
  _entityType: string,
  _entityId: string,
  _operation: string,
  _payload: Record<string, unknown>
): Promise<void> {}
export async function getSyncQueue(): Promise<LocalSyncQueue[]> {
  return [];
}
export async function removeSyncQueueItem(_id: number): Promise<void> {}
export async function updateSyncQueueAttempt(_id: number, _error: string | null): Promise<void> {}
export async function getSyncQueueCount(): Promise<number> {
  return 0;
}
export async function clearSyncQueue(): Promise<void> {}

// Utility
export async function clearAllData(): Promise<void> {}
export async function getDatabaseStats(): Promise<{
  reports: number;
  photos: number;
  defects: number;
  elements: number;
  pendingSync: number;
  checklists: number;
}> {
  return { reports: 0, photos: 0, defects: 0, elements: 0, pendingSync: 0, checklists: 0 };
}

export async function getReportWithRelations(_reportId: string): Promise<{
  report: LocalReport;
  elements: LocalRoofElement[];
  defects: LocalDefect[];
  photos: LocalPhoto[];
  compliance: LocalComplianceAssessment | null;
} | null> {
  return null;
}
