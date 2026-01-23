/**
 * SQLite Database Manager
 * Handles local database initialization and queries
 */

import * as SQLite from "expo-sqlite";
import {
  DATABASE_NAME,
  CREATE_TABLES_SQL,
  type LocalUser,
  type LocalReportDraft,
  type LocalPhoto,
  type LocalDefect,
  type LocalRoofElement,
  type LocalComplianceAssessment,
  type LocalComplianceResult,
  type LocalChecklist,
  type LocalTemplate,
  type LocalSyncQueue,
} from "../types/database";

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database and create tables
 */
export async function initializeDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Execute all CREATE TABLE statements
    await db.execAsync(CREATE_TABLES_SQL);

    console.log("[SQLite] Database initialized successfully");
  } catch (error) {
    console.error("[SQLite] Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Get the database instance
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return db;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// ============================================
// USER OPERATIONS
// ============================================

export async function saveUser(user: LocalUser): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO users (id, clerk_id, email, name, role, qualifications, lbp_number, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.clerkId, user.email, user.name, user.role, user.qualifications, user.lbpNumber, user.syncedAt]
  );
}

export async function getUser(): Promise<LocalUser | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<{
    id: string;
    clerk_id: string;
    email: string;
    name: string;
    role: string;
    qualifications: string | null;
    lbp_number: string | null;
    synced_at: string | null;
  }>("SELECT * FROM users LIMIT 1");

  if (!result) return null;

  return {
    id: result.id,
    clerkId: result.clerk_id,
    email: result.email,
    name: result.name,
    role: result.role,
    qualifications: result.qualifications,
    lbpNumber: result.lbp_number,
    syncedAt: result.synced_at,
  };
}

// ============================================
// CHECKLIST OPERATIONS
// ============================================

export async function saveChecklist(checklist: LocalChecklist): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO checklists (id, name, version, category, standard, definition, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [checklist.id, checklist.name, checklist.version, checklist.category, checklist.standard, checklist.definition, checklist.downloadedAt]
  );
}

export async function getAllChecklists(): Promise<LocalChecklist[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<{
    id: string;
    name: string;
    version: string;
    category: string;
    standard: string;
    definition: string;
    downloaded_at: string;
  }>("SELECT * FROM checklists");

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    version: row.version || "1.0",
    category: row.category,
    standard: row.standard,
    definition: row.definition,
    downloadedAt: row.downloaded_at,
  }));
}

export async function getChecklistByStandard(standard: string): Promise<LocalChecklist | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<{
    id: string;
    name: string;
    version: string;
    category: string;
    standard: string;
    definition: string;
    downloaded_at: string;
  }>("SELECT * FROM checklists WHERE standard = ?", [standard]);

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    version: result.version || "1.0",
    category: result.category,
    standard: result.standard,
    definition: result.definition,
    downloadedAt: result.downloaded_at,
  };
}

// ============================================
// TEMPLATE OPERATIONS
// ============================================

export async function saveTemplate(template: LocalTemplate): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO templates (id, name, description, inspection_type, sections_json, checklists_json, is_default, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      template.id,
      template.name,
      template.description,
      template.inspectionType,
      template.sectionsJson,
      template.checklistsJson,
      template.isDefault ? 1 : 0,
      template.downloadedAt,
    ]
  );
}

export async function getAllTemplates(): Promise<LocalTemplate[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<{
    id: string;
    name: string;
    description: string | null;
    inspection_type: string;
    sections_json: string;
    checklists_json: string | null;
    is_default: number;
    downloaded_at: string;
  }>("SELECT * FROM templates");

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    inspectionType: row.inspection_type as LocalTemplate["inspectionType"],
    sectionsJson: row.sections_json,
    checklistsJson: row.checklists_json,
    isDefault: row.is_default === 1,
    downloadedAt: row.downloaded_at,
  }));
}

// ============================================
// REPORT DRAFT OPERATIONS
// ============================================

export async function saveReportDraft(draft: LocalReportDraft): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO report_drafts (
      id, report_id, report_number, property_address, property_city, property_region,
      property_postcode, property_type, building_age, client_name, client_email, client_phone,
      inspection_date, inspection_type, weather_conditions, access_method, limitations,
      executive_summary, conclusions, status, sync_status, created_at, updated_at, synced_at, last_sync_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.reportId,
      draft.reportNumber,
      draft.propertyAddress,
      draft.propertyCity,
      draft.propertyRegion,
      draft.propertyPostcode,
      draft.propertyType,
      draft.buildingAge,
      draft.clientName,
      draft.clientEmail,
      draft.clientPhone,
      draft.inspectionDate,
      draft.inspectionType,
      draft.weatherConditions,
      draft.accessMethod,
      draft.limitations,
      draft.executiveSummary,
      draft.conclusions,
      draft.status,
      draft.syncStatus,
      draft.createdAt,
      draft.updatedAt,
      draft.syncedAt,
      draft.lastSyncError,
    ]
  );
}

export async function getReportDraft(id: string): Promise<LocalReportDraft | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM report_drafts WHERE id = ?",
    [id]
  );

  if (!result) return null;

  return mapReportDraftRow(result);
}

export async function getAllReportDrafts(): Promise<LocalReportDraft[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM report_drafts ORDER BY updated_at DESC"
  );

  return results.map(mapReportDraftRow);
}

export async function getPendingSyncReports(): Promise<LocalReportDraft[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM report_drafts WHERE sync_status IN ('draft', 'pending', 'error') ORDER BY updated_at ASC"
  );

  return results.map(mapReportDraftRow);
}

function mapReportDraftRow(row: Record<string, unknown>): LocalReportDraft {
  return {
    id: row.id as string,
    reportId: row.report_id as string | null,
    reportNumber: row.report_number as string | null,
    propertyAddress: row.property_address as string,
    propertyCity: row.property_city as string,
    propertyRegion: row.property_region as string,
    propertyPostcode: row.property_postcode as string,
    propertyType: row.property_type as LocalReportDraft["propertyType"],
    buildingAge: row.building_age as number | null,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string | null,
    clientPhone: row.client_phone as string | null,
    inspectionDate: row.inspection_date as string,
    inspectionType: row.inspection_type as LocalReportDraft["inspectionType"],
    weatherConditions: row.weather_conditions as string | null,
    accessMethod: row.access_method as string | null,
    limitations: row.limitations as string | null,
    executiveSummary: row.executive_summary as string | null,
    conclusions: row.conclusions as string | null,
    status: row.status as LocalReportDraft["status"],
    syncStatus: row.sync_status as LocalReportDraft["syncStatus"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: row.synced_at as string | null,
    lastSyncError: row.last_sync_error as string | null,
  };
}

// ============================================
// PHOTO OPERATIONS
// ============================================

export async function savePhoto(photo: LocalPhoto): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO photos (
      id, local_id, report_id, defect_id, roof_element_id, local_uri, thumbnail_uri,
      original_filename, mime_type, file_size, photo_type, captured_at, gps_lat, gps_lng,
      gps_altitude, gps_accuracy, camera_make, camera_model, exposure_time, f_number,
      iso, focal_length, original_hash, caption, sort_order, status, uploaded_url,
      synced_at, last_sync_error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      photo.id,
      photo.localId,
      photo.reportId,
      photo.defectId,
      photo.roofElementId,
      photo.localUri,
      photo.thumbnailUri,
      photo.originalFilename,
      photo.mimeType,
      photo.fileSize,
      photo.photoType,
      photo.capturedAt,
      photo.gpsLat,
      photo.gpsLng,
      photo.gpsAltitude,
      photo.gpsAccuracy,
      photo.cameraMake,
      photo.cameraModel,
      photo.exposureTime,
      photo.fNumber,
      photo.iso,
      photo.focalLength,
      photo.originalHash,
      photo.caption,
      photo.sortOrder,
      photo.status,
      photo.uploadedUrl,
      photo.syncedAt,
      photo.lastSyncError,
      photo.createdAt,
    ]
  );
}

export async function getPhotosForReport(reportId: string): Promise<LocalPhoto[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM photos WHERE report_id = ? ORDER BY sort_order ASC",
    [reportId]
  );

  return results.map(mapPhotoRow);
}

export async function getPendingUploadPhotos(): Promise<LocalPhoto[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM photos WHERE status IN ('captured', 'processing') ORDER BY created_at ASC"
  );

  return results.map(mapPhotoRow);
}

function mapPhotoRow(row: Record<string, unknown>): LocalPhoto {
  return {
    id: row.id as string,
    localId: row.local_id as string,
    reportId: row.report_id as string,
    defectId: row.defect_id as string | null,
    roofElementId: row.roof_element_id as string | null,
    localUri: row.local_uri as string,
    thumbnailUri: row.thumbnail_uri as string | null,
    originalFilename: row.original_filename as string,
    mimeType: row.mime_type as string,
    fileSize: row.file_size as number,
    photoType: row.photo_type as LocalPhoto["photoType"],
    capturedAt: row.captured_at as string | null,
    gpsLat: row.gps_lat as number | null,
    gpsLng: row.gps_lng as number | null,
    gpsAltitude: row.gps_altitude as number | null,
    gpsAccuracy: row.gps_accuracy as number | null,
    cameraMake: row.camera_make as string | null,
    cameraModel: row.camera_model as string | null,
    exposureTime: row.exposure_time as number | null,
    fNumber: row.f_number as number | null,
    iso: row.iso as number | null,
    focalLength: row.focal_length as number | null,
    originalHash: row.original_hash as string,
    caption: row.caption as string | null,
    sortOrder: row.sort_order as number,
    status: row.status as LocalPhoto["status"],
    uploadedUrl: row.uploaded_url as string | null,
    syncedAt: row.synced_at as string | null,
    lastSyncError: row.last_sync_error as string | null,
    createdAt: row.created_at as string,
  };
}

export async function deletePhoto(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM photos WHERE id = ?", [id]);
}

// ============================================
// COMPLIANCE RESULTS OPERATIONS
// ============================================

export async function saveComplianceResult(result: LocalComplianceResult): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO compliance_results (
      id, report_id, checklist_id, item_ref, item_description, status,
      notes, evidence_photo_ids, assessed_at, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.id,
      result.reportId,
      result.checklistId,
      result.itemRef,
      result.itemDescription,
      result.status,
      result.notes,
      result.evidencePhotoIds,
      result.assessedAt,
      result.syncStatus,
      result.createdAt,
      result.updatedAt,
    ]
  );
}

export async function getComplianceResultsForReport(reportId: string): Promise<LocalComplianceResult[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<{
    id: string;
    report_id: string;
    checklist_id: string;
    item_ref: string;
    item_description: string;
    status: string;
    notes: string | null;
    evidence_photo_ids: string | null;
    assessed_at: string;
    sync_status: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM compliance_results WHERE report_id = ? ORDER BY item_ref", [reportId]);

  return results.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    checklistId: row.checklist_id,
    itemRef: row.item_ref,
    itemDescription: row.item_description,
    status: row.status as LocalComplianceResult["status"],
    notes: row.notes,
    evidencePhotoIds: row.evidence_photo_ids,
    assessedAt: row.assessed_at,
    syncStatus: row.sync_status as LocalComplianceResult["syncStatus"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function deleteComplianceResult(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM compliance_results WHERE id = ?", [id]);
}

// ============================================
// SYNC QUEUE OPERATIONS
// ============================================

export async function addToSyncQueue(
  entityType: string,
  entityId: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT INTO sync_queue (entity_type, entity_id, operation, payload_json, created_at, attempt_count)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [entityType, entityId, operation, JSON.stringify(payload), new Date().toISOString()]
  );
}

export async function getSyncQueue(): Promise<LocalSyncQueue[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<{
    id: number;
    entity_type: string;
    entity_id: string;
    operation: string;
    payload_json: string;
    created_at: string;
    attempt_count: number;
    last_error: string | null;
  }>("SELECT * FROM sync_queue ORDER BY created_at ASC");

  return results.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
  }));
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
}

export async function updateSyncQueueAttempt(id: number, error: string | null): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    "UPDATE sync_queue SET attempt_count = attempt_count + 1, last_error = ? WHERE id = ?",
    [error, id]
  );
}

export async function getSyncQueueCount(): Promise<number> {
  const database = getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue"
  );
  return result?.count ?? 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function clearAllData(): Promise<void> {
  const database = getDatabase();
  await database.execAsync(`
    DELETE FROM sync_queue;
    DELETE FROM photos;
    DELETE FROM defects;
    DELETE FROM roof_elements;
    DELETE FROM compliance_assessments;
    DELETE FROM report_drafts;
    DELETE FROM checklists;
    DELETE FROM templates;
    DELETE FROM users;
  `);
}

export async function getDatabaseStats(): Promise<{
  reports: number;
  photos: number;
  pendingSync: number;
  checklists: number;
}> {
  const database = getDatabase();

  const [reports, photos, pendingSync, checklists] = await Promise.all([
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM report_drafts"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM photos"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM checklists"),
  ]);

  return {
    reports: reports?.count ?? 0,
    photos: photos?.count ?? 0,
    pendingSync: pendingSync?.count ?? 0,
    checklists: checklists?.count ?? 0,
  };
}
