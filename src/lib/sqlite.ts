/**
 * SQLite Database Manager
 * Handles local database initialization and queries
 *
 * This module provides offline-first data persistence for the RANZ mobile app.
 * The schema mirrors the Prisma schema from the web backend.
 */

import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  CREATE_TABLES_SQL,
  MIGRATIONS,
  type LocalUser,
  type LocalReport,
  type LocalPhoto,
  type LocalDefect,
  type LocalRoofElement,
  type LocalComplianceAssessment,
  type LocalChecklist,
  type LocalTemplate,
  type LocalSyncQueue,
  type LocalSyncState,
} from "../types/database";

let db: SQLite.SQLiteDatabase | null = null;

// ============================================
// DATABASE INITIALIZATION
// ============================================

/**
 * Initialize the database and create tables
 */
export async function initializeDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Check current version and run migrations if needed
    const currentVersion = await getDatabaseVersion();

    if (currentVersion < DATABASE_VERSION) {
      console.log(`[SQLite] Migrating from v${currentVersion} to v${DATABASE_VERSION}`);
      await runMigrations(currentVersion);
    }

    // Execute all CREATE TABLE statements
    await db.execAsync(CREATE_TABLES_SQL);

    // Update version
    await setDatabaseVersion(DATABASE_VERSION);

    // Ensure sync state exists
    await ensureSyncState();

    console.log("[SQLite] Database initialized successfully (v" + DATABASE_VERSION + ")");
  } catch (error) {
    console.error("[SQLite] Failed to initialize database:", error);
    throw error;
  }
}

async function getDatabaseVersion(): Promise<number> {
  try {
    const result = await db!.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version"
    );
    return result?.user_version ?? 0;
  } catch {
    return 0;
  }
}

async function setDatabaseVersion(version: number): Promise<void> {
  await db!.execAsync(`PRAGMA user_version = ${version}`);
}

async function runMigrations(fromVersion: number): Promise<void> {
  for (const migration of MIGRATIONS) {
    if (migration.version > fromVersion) {
      console.log(`[SQLite] Running migration v${migration.version}`);
      await db!.execAsync(migration.sql);
    }
  }
}

async function ensureSyncState(): Promise<void> {
  const existing = await db!.getFirstAsync<{ id: number }>(
    "SELECT id FROM sync_state WHERE id = 1"
  );

  if (!existing) {
    const deviceId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`
    );

    await db!.runAsync(
      "INSERT INTO sync_state (id, device_id) VALUES (1, ?)",
      [deviceId.substring(0, 32)]
    );
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
// SYNC STATE OPERATIONS
// ============================================

export async function getSyncState(): Promise<LocalSyncState | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<{
    id: number;
    last_bootstrap_at: string | null;
    last_upload_at: string | null;
    device_id: string;
  }>("SELECT * FROM sync_state WHERE id = 1");

  if (!result) return null;

  return {
    id: result.id,
    lastBootstrapAt: result.last_bootstrap_at,
    lastUploadAt: result.last_upload_at,
    deviceId: result.device_id,
  };
}

export async function updateSyncState(
  updates: Partial<Omit<LocalSyncState, "id" | "deviceId">>
): Promise<void> {
  const database = getDatabase();
  const sets: string[] = [];
  const values: (string | null)[] = [];

  if (updates.lastBootstrapAt !== undefined) {
    sets.push("last_bootstrap_at = ?");
    values.push(updates.lastBootstrapAt);
  }
  if (updates.lastUploadAt !== undefined) {
    sets.push("last_upload_at = ?");
    values.push(updates.lastUploadAt);
  }

  if (sets.length > 0) {
    await database.runAsync(
      `UPDATE sync_state SET ${sets.join(", ")} WHERE id = 1`,
      values
    );
  }
}

// ============================================
// USER OPERATIONS
// ============================================

export async function saveUser(user: LocalUser): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO users (
      id, clerk_id, email, name, phone, role, company,
      qualifications, lbp_number, years_experience, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.clerkId,
      user.email,
      user.name,
      user.phone,
      user.role,
      user.company,
      user.qualifications,
      user.lbpNumber,
      user.yearsExperience,
      user.syncedAt,
    ]
  );
}

export async function getUser(): Promise<LocalUser | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM users LIMIT 1"
  );

  if (!result) return null;

  return mapUserRow(result);
}

function mapUserRow(row: Record<string, unknown>): LocalUser {
  return {
    id: row.id as string,
    clerkId: row.clerk_id as string,
    email: row.email as string,
    name: row.name as string,
    phone: row.phone as string | null,
    role: row.role as LocalUser["role"],
    company: row.company as string | null,
    qualifications: row.qualifications as string | null,
    lbpNumber: row.lbp_number as string | null,
    yearsExperience: row.years_experience as number | null,
    syncedAt: row.synced_at as string | null,
  };
}

export async function clearUser(): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM users");
}

// ============================================
// REPORT OPERATIONS
// ============================================

export async function saveReport(report: LocalReport): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO reports (
      id, report_number, status,
      property_address, property_city, property_region, property_postcode,
      property_type, building_age, gps_lat, gps_lng,
      inspection_date, inspection_type, weather_conditions, access_method, limitations,
      client_name, client_email, client_phone,
      scope_of_works_json, methodology_json, findings_json, conclusions_json, recommendations_json,
      declaration_signed, signed_at,
      sync_status, created_at, updated_at, synced_at, last_sync_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report.id,
      report.reportNumber,
      report.status,
      report.propertyAddress,
      report.propertyCity,
      report.propertyRegion,
      report.propertyPostcode,
      report.propertyType,
      report.buildingAge,
      report.gpsLat,
      report.gpsLng,
      report.inspectionDate,
      report.inspectionType,
      report.weatherConditions,
      report.accessMethod,
      report.limitations,
      report.clientName,
      report.clientEmail,
      report.clientPhone,
      report.scopeOfWorksJson,
      report.methodologyJson,
      report.findingsJson,
      report.conclusionsJson,
      report.recommendationsJson,
      report.declarationSigned ? 1 : 0,
      report.signedAt,
      report.syncStatus,
      report.createdAt,
      report.updatedAt,
      report.syncedAt,
      report.lastSyncError,
    ]
  );
}

export async function getReport(id: string): Promise<LocalReport | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM reports WHERE id = ?",
    [id]
  );

  if (!result) return null;
  return mapReportRow(result);
}

export async function getAllReports(): Promise<LocalReport[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM reports ORDER BY updated_at DESC"
  );

  return results.map(mapReportRow);
}

export async function getPendingSyncReports(): Promise<LocalReport[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM reports WHERE sync_status IN ('draft', 'pending', 'error') ORDER BY updated_at ASC"
  );

  return results.map(mapReportRow);
}

export async function deleteReport(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM reports WHERE id = ?", [id]);
}

function mapReportRow(row: Record<string, unknown>): LocalReport {
  return {
    id: row.id as string,
    reportNumber: row.report_number as string | null,
    status: row.status as LocalReport["status"],
    propertyAddress: row.property_address as string,
    propertyCity: row.property_city as string,
    propertyRegion: row.property_region as string,
    propertyPostcode: row.property_postcode as string,
    propertyType: row.property_type as LocalReport["propertyType"],
    buildingAge: row.building_age as number | null,
    gpsLat: row.gps_lat as number | null,
    gpsLng: row.gps_lng as number | null,
    inspectionDate: row.inspection_date as string,
    inspectionType: row.inspection_type as LocalReport["inspectionType"],
    weatherConditions: row.weather_conditions as string | null,
    accessMethod: row.access_method as string | null,
    limitations: row.limitations as string | null,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string | null,
    clientPhone: row.client_phone as string | null,
    scopeOfWorksJson: row.scope_of_works_json as string | null,
    methodologyJson: row.methodology_json as string | null,
    findingsJson: row.findings_json as string | null,
    conclusionsJson: row.conclusions_json as string | null,
    recommendationsJson: row.recommendations_json as string | null,
    declarationSigned: (row.declaration_signed as number) === 1,
    signedAt: row.signed_at as string | null,
    syncStatus: row.sync_status as LocalReport["syncStatus"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: row.synced_at as string | null,
    lastSyncError: row.last_sync_error as string | null,
  };
}

// ============================================
// ROOF ELEMENT OPERATIONS
// ============================================

export async function saveRoofElement(element: LocalRoofElement): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO roof_elements (
      id, report_id, element_type, location, cladding_type, material,
      manufacturer, pitch, area, condition_rating, condition_notes,
      sync_status, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      element.id,
      element.reportId,
      element.elementType,
      element.location,
      element.claddingType,
      element.material,
      element.manufacturer,
      element.pitch,
      element.area,
      element.conditionRating,
      element.conditionNotes,
      element.syncStatus,
      element.createdAt,
      element.updatedAt,
      element.syncedAt,
    ]
  );
}

export async function getRoofElementsForReport(reportId: string): Promise<LocalRoofElement[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM roof_elements WHERE report_id = ? ORDER BY created_at ASC",
    [reportId]
  );

  return results.map(mapRoofElementRow);
}

export async function deleteRoofElement(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM roof_elements WHERE id = ?", [id]);
}

function mapRoofElementRow(row: Record<string, unknown>): LocalRoofElement {
  return {
    id: row.id as string,
    reportId: row.report_id as string,
    elementType: row.element_type as LocalRoofElement["elementType"],
    location: row.location as string,
    claddingType: row.cladding_type as string | null,
    material: row.material as string | null,
    manufacturer: row.manufacturer as string | null,
    pitch: row.pitch as number | null,
    area: row.area as number | null,
    conditionRating: row.condition_rating as LocalRoofElement["conditionRating"],
    conditionNotes: row.condition_notes as string | null,
    syncStatus: row.sync_status as LocalRoofElement["syncStatus"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: row.synced_at as string | null,
  };
}

// ============================================
// DEFECT OPERATIONS
// ============================================

export async function saveDefect(defect: LocalDefect): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO defects (
      id, report_id, roof_element_id, defect_number, title, description, location,
      classification, severity, observation, analysis, opinion,
      code_reference, cop_reference, recommendation, priority_level,
      sync_status, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      defect.id,
      defect.reportId,
      defect.roofElementId,
      defect.defectNumber,
      defect.title,
      defect.description,
      defect.location,
      defect.classification,
      defect.severity,
      defect.observation,
      defect.analysis,
      defect.opinion,
      defect.codeReference,
      defect.copReference,
      defect.recommendation,
      defect.priorityLevel,
      defect.syncStatus,
      defect.createdAt,
      defect.updatedAt,
      defect.syncedAt,
    ]
  );
}

export async function getDefectsForReport(reportId: string): Promise<LocalDefect[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM defects WHERE report_id = ? ORDER BY defect_number ASC",
    [reportId]
  );

  return results.map(mapDefectRow);
}

export async function getNextDefectNumber(reportId: string): Promise<number> {
  const database = getDatabase();
  const result = await database.getFirstAsync<{ max_num: number | null }>(
    "SELECT MAX(defect_number) as max_num FROM defects WHERE report_id = ?",
    [reportId]
  );
  return (result?.max_num ?? 0) + 1;
}

export async function deleteDefect(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM defects WHERE id = ?", [id]);
}

function mapDefectRow(row: Record<string, unknown>): LocalDefect {
  return {
    id: row.id as string,
    reportId: row.report_id as string,
    roofElementId: row.roof_element_id as string | null,
    defectNumber: row.defect_number as number,
    title: row.title as string,
    description: row.description as string,
    location: row.location as string,
    classification: row.classification as LocalDefect["classification"],
    severity: row.severity as LocalDefect["severity"],
    observation: row.observation as string,
    analysis: row.analysis as string | null,
    opinion: row.opinion as string | null,
    codeReference: row.code_reference as string | null,
    copReference: row.cop_reference as string | null,
    recommendation: row.recommendation as string | null,
    priorityLevel: row.priority_level as LocalDefect["priorityLevel"],
    syncStatus: row.sync_status as LocalDefect["syncStatus"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: row.synced_at as string | null,
  };
}

// ============================================
// PHOTO OPERATIONS
// ============================================

export async function savePhoto(photo: LocalPhoto): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO photos (
      id, report_id, defect_id, roof_element_id,
      local_uri, thumbnail_uri, filename, original_filename, mime_type, file_size,
      photo_type, captured_at, gps_lat, gps_lng, gps_altitude, gps_accuracy,
      camera_make, camera_model, exposure_time, f_number, iso, focal_length,
      original_hash, caption, sort_order,
      sync_status, uploaded_url, synced_at, last_sync_error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      photo.id,
      photo.reportId,
      photo.defectId,
      photo.roofElementId,
      photo.localUri,
      photo.thumbnailUri,
      photo.filename,
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
      photo.syncStatus,
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

export async function getPhotosForDefect(defectId: string): Promise<LocalPhoto[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM photos WHERE defect_id = ? ORDER BY sort_order ASC",
    [defectId]
  );

  return results.map(mapPhotoRow);
}

export async function getPendingUploadPhotos(): Promise<LocalPhoto[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM photos WHERE sync_status IN ('captured', 'processing') ORDER BY created_at ASC"
  );

  return results.map(mapPhotoRow);
}

export async function updatePhotoSyncStatus(
  id: string,
  status: LocalPhoto["syncStatus"],
  uploadedUrl?: string,
  error?: string
): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `UPDATE photos SET sync_status = ?, uploaded_url = ?, last_sync_error = ?,
     synced_at = CASE WHEN ? = 'synced' THEN ? ELSE synced_at END
     WHERE id = ?`,
    [status, uploadedUrl ?? null, error ?? null, status, new Date().toISOString(), id]
  );
}

export async function deletePhoto(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM photos WHERE id = ?", [id]);
}

function mapPhotoRow(row: Record<string, unknown>): LocalPhoto {
  return {
    id: row.id as string,
    reportId: row.report_id as string,
    defectId: row.defect_id as string | null,
    roofElementId: row.roof_element_id as string | null,
    localUri: row.local_uri as string,
    thumbnailUri: row.thumbnail_uri as string | null,
    filename: row.filename as string,
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
    syncStatus: row.sync_status as LocalPhoto["syncStatus"],
    uploadedUrl: row.uploaded_url as string | null,
    syncedAt: row.synced_at as string | null,
    lastSyncError: row.last_sync_error as string | null,
    createdAt: row.created_at as string,
  };
}

// ============================================
// COMPLIANCE ASSESSMENT OPERATIONS
// ============================================

export async function saveComplianceAssessment(assessment: LocalComplianceAssessment): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO compliance_assessments (
      id, report_id, checklist_results_json, non_compliance_summary,
      sync_status, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assessment.id,
      assessment.reportId,
      assessment.checklistResultsJson,
      assessment.nonComplianceSummary,
      assessment.syncStatus,
      assessment.createdAt,
      assessment.updatedAt,
      assessment.syncedAt,
    ]
  );
}

export async function getComplianceAssessment(reportId: string): Promise<LocalComplianceAssessment | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM compliance_assessments WHERE report_id = ?",
    [reportId]
  );

  if (!result) return null;

  return {
    id: result.id as string,
    reportId: result.report_id as string,
    checklistResultsJson: result.checklist_results_json as string,
    nonComplianceSummary: result.non_compliance_summary as string | null,
    syncStatus: result.sync_status as LocalComplianceAssessment["syncStatus"],
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string,
    syncedAt: result.synced_at as string | null,
  };
}

export async function deleteComplianceAssessment(reportId: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM compliance_assessments WHERE report_id = ?", [reportId]);
}

// ============================================
// CHECKLIST OPERATIONS
// ============================================

export async function saveChecklist(checklist: LocalChecklist): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO checklists (id, name, category, standard, items_json, downloaded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      checklist.id,
      checklist.name,
      checklist.category,
      checklist.standard,
      checklist.itemsJson,
      checklist.downloadedAt,
      checklist.updatedAt,
    ]
  );
}

export async function getAllChecklists(): Promise<LocalChecklist[]> {
  const database = getDatabase();
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM checklists ORDER BY name"
  );

  return results.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    standard: row.standard as string | null,
    itemsJson: row.items_json as string,
    downloadedAt: row.downloaded_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function getChecklistByStandard(standard: string): Promise<LocalChecklist | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM checklists WHERE standard = ?",
    [standard]
  );

  if (!result) return null;

  return {
    id: result.id as string,
    name: result.name as string,
    category: result.category as string,
    standard: result.standard as string | null,
    itemsJson: result.items_json as string,
    downloadedAt: result.downloaded_at as string,
    updatedAt: result.updated_at as string,
  };
}

// ============================================
// TEMPLATE OPERATIONS
// ============================================

export async function saveTemplate(template: LocalTemplate): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO templates (
      id, name, description, inspection_type, sections_json, checklists_json, is_default, downloaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM templates ORDER BY name"
  );

  return results.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    inspectionType: row.inspection_type as LocalTemplate["inspectionType"],
    sectionsJson: row.sections_json as string,
    checklistsJson: row.checklists_json as string | null,
    isDefault: (row.is_default as number) === 1,
    downloadedAt: row.downloaded_at as string,
  }));
}

export async function getDefaultTemplate(): Promise<LocalTemplate | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM templates WHERE is_default = 1 LIMIT 1"
  );

  if (!result) return null;

  return {
    id: result.id as string,
    name: result.name as string,
    description: result.description as string | null,
    inspectionType: result.inspection_type as LocalTemplate["inspectionType"],
    sectionsJson: result.sections_json as string,
    checklistsJson: result.checklists_json as string | null,
    isDefault: true,
    downloadedAt: result.downloaded_at as string,
  };
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
  const results = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM sync_queue ORDER BY created_at ASC"
  );

  return results.map((row) => ({
    id: row.id as number,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    operation: row.operation as string,
    payloadJson: row.payload_json as string,
    createdAt: row.created_at as string,
    attemptCount: row.attempt_count as number,
    lastError: row.last_error as string | null,
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

export async function clearSyncQueue(): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM sync_queue");
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
    DELETE FROM reports;
    DELETE FROM checklists;
    DELETE FROM templates;
    DELETE FROM users;
    UPDATE sync_state SET last_bootstrap_at = NULL, last_upload_at = NULL WHERE id = 1;
  `);
}

export async function getDatabaseStats(): Promise<{
  reports: number;
  photos: number;
  defects: number;
  elements: number;
  pendingSync: number;
  checklists: number;
}> {
  const database = getDatabase();

  const [reports, photos, defects, elements, pendingSync, checklists] = await Promise.all([
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM reports"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM photos"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM defects"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM roof_elements"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue"),
    database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM checklists"),
  ]);

  return {
    reports: reports?.count ?? 0,
    photos: photos?.count ?? 0,
    defects: defects?.count ?? 0,
    elements: elements?.count ?? 0,
    pendingSync: pendingSync?.count ?? 0,
    checklists: checklists?.count ?? 0,
  };
}

/**
 * Get a full report with all related data
 */
export async function getReportWithRelations(reportId: string): Promise<{
  report: LocalReport;
  elements: LocalRoofElement[];
  defects: LocalDefect[];
  photos: LocalPhoto[];
  compliance: LocalComplianceAssessment | null;
} | null> {
  const report = await getReport(reportId);
  if (!report) return null;

  const [elements, defects, photos, compliance] = await Promise.all([
    getRoofElementsForReport(reportId),
    getDefectsForReport(reportId),
    getPhotosForReport(reportId),
    getComplianceAssessment(reportId),
  ]);

  return { report, elements, defects, photos, compliance };
}
