/**
 * Local SQLite Database Types
 * Types for offline-first storage on mobile device
 *
 * This schema mirrors the Prisma schema from the web backend.
 */

import type {
  InspectionType,
  PropertyType,
  ReportStatus,
  PhotoType,
  QuickTag,
  DefectClass,
  DefectSeverity,
  PriorityLevel,
  ElementType,
  ConditionRating,
  SyncStatus,
  PhotoSyncStatus,
  ComplianceStatus,
  UserRole,
  UserStatus,
} from "./shared";

// ============================================
// LOCAL DATABASE RECORD TYPES
// ============================================

export interface LocalUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  company: string | null;
  qualifications: string | null;
  lbpNumber: string | null;
  yearsExperience: number | null;
  syncedAt: string | null;
}

export interface LocalReport {
  id: string;
  reportNumber: string | null; // null until synced, server generates RANZ-YYYY-NNNNN
  status: ReportStatus;

  // Property Details
  propertyAddress: string;
  propertyCity: string;
  propertyRegion: string;
  propertyPostcode: string;
  propertyType: PropertyType;
  buildingAge: number | null;
  gpsLat: number | null;
  gpsLng: number | null;

  // Inspection Details
  inspectionDate: string;
  inspectionType: InspectionType;
  weatherConditions: string | null;
  accessMethod: string | null;
  limitations: string | null;

  // Client Information
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;

  // Report Content (stored as JSON strings)
  scopeOfWorksJson: string | null;
  methodologyJson: string | null;
  findingsJson: string | null;
  conclusionsJson: string | null;
  recommendationsJson: string | null;

  // Sign-off
  declarationSigned: boolean;
  signedAt: string | null;

  // Inspector
  inspectorId: string | null;

  // Submission/Approval
  submittedAt: string | null;
  approvedAt: string | null;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  lastSyncError: string | null;
}

export interface LocalRoofElement {
  id: string;
  reportId: string;

  elementType: ElementType;
  location: string;
  claddingType: string | null;
  material: string | null;
  manufacturer: string | null;
  pitch: number | null;
  area: number | null;
  conditionRating: ConditionRating | null;
  conditionNotes: string | null;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalDefect {
  id: string;
  reportId: string;
  roofElementId: string | null;

  defectNumber: number;
  title: string;
  description: string;
  location: string;

  classification: DefectClass;
  severity: DefectSeverity;

  // Three-part structure (ISO compliant)
  observation: string;
  analysis: string | null;
  opinion: string | null;

  codeReference: string | null;
  copReference: string | null;

  recommendation: string | null;
  priorityLevel: PriorityLevel | null;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalPhoto {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;

  // Local file info
  localUri: string;
  thumbnailUri: string | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;

  photoType: PhotoType;
  quickTag: QuickTag | null;

  // EXIF Metadata (captured at moment of photo)
  capturedAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAltitude: number | null;
  gpsAccuracy: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  exposureTime: number | null;
  fNumber: number | null;
  iso: number | null;
  focalLength: number | null;

  // Evidence integrity
  originalHash: string;

  // Annotations
  annotationsJson: string | null;
  annotatedUri: string | null;

  // Measurements
  measurementsJson: string | null;
  calibrationJson: string | null;
  measuredUri: string | null;

  caption: string | null;
  sortOrder: number;

  // Sync tracking
  syncStatus: PhotoSyncStatus;
  uploadedUrl: string | null;
  syncedAt: string | null;
  lastSyncError: string | null;

  createdAt: string;
}

export interface LocalComplianceAssessment {
  id: string;
  reportId: string;

  // Stored as JSON string: {e2_as1: {item_1: "PASS", ...}, ...}
  checklistResultsJson: string;
  nonComplianceSummary: string | null;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalChecklist {
  id: string;
  name: string;
  category: string;
  standard: string | null;
  itemsJson: string; // JSON string of ChecklistItem[]
  downloadedAt: string;
  updatedAt: string;
}

export interface LocalTemplate {
  id: string;
  name: string;
  description: string | null;
  inspectionType: InspectionType;
  sectionsJson: string; // JSON string of string[]
  checklistsJson: string | null; // JSON string of { compliance?: string[] }
  isDefault: boolean;
  downloadedAt: string;
}

export interface LocalSyncQueue {
  id: number;
  entityType: string;
  entityId: string;
  operation: string;
  payloadJson: string;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
}

export interface LocalSyncState {
  id: number;
  lastBootstrapAt: string | null;
  lastUploadAt: string | null;
  deviceId: string;
}

export interface LocalVoiceNote {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;

  // File info
  localUri: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  durationMs: number;

  // Metadata
  recordedAt: string;
  transcription: string | null;

  // Evidence integrity
  originalHash: string;

  // Sync tracking
  syncStatus: SyncStatus;
  uploadedUrl: string | null;
  syncedAt: string | null;
  lastSyncError: string | null;

  createdAt: string;
}

export interface LocalVideo {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;

  // File info
  localUri: string;
  thumbnailUri: string | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  durationMs: number;

  // Metadata
  title: string | null;
  description: string | null;
  recordedAt: string;

  // GPS (captured at start of recording)
  gpsLat: number | null;
  gpsLng: number | null;

  // Evidence integrity
  originalHash: string;

  // GPS track (array of coordinates during recording)
  gpsTrackJson: string | null;

  // Sync tracking
  syncStatus: SyncStatus;
  uploadedUrl: string | null;
  syncedAt: string | null;
  lastSyncError: string | null;

  createdAt: string;
}

export interface LocalAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  details: string | null;
  createdAt: string;
}

// ============================================
// DATABASE SCHEMA CREATION
// ============================================

export const DATABASE_NAME = "ranz_mobile.db";
export const DATABASE_VERSION = 10; // Incremented for schema changes (v10: added voice note evidence integrity)

export const CREATE_TABLES_SQL = `
-- Sync State (singleton table for tracking sync metadata)
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_bootstrap_at TEXT,
  last_upload_at TEXT,
  device_id TEXT NOT NULL
);

-- Users (for offline auth state)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'INSPECTOR',
  company TEXT,
  qualifications TEXT,
  lbp_number TEXT,
  years_experience INTEGER,
  synced_at TEXT
);

-- Reports (local report data, mirrors Prisma Report model)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  report_number TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',

  -- Property Details
  property_address TEXT NOT NULL,
  property_city TEXT NOT NULL,
  property_region TEXT NOT NULL,
  property_postcode TEXT NOT NULL,
  property_type TEXT NOT NULL,
  building_age INTEGER,
  gps_lat REAL,
  gps_lng REAL,

  -- Inspection Details
  inspection_date TEXT NOT NULL,
  inspection_type TEXT NOT NULL,
  weather_conditions TEXT,
  access_method TEXT,
  limitations TEXT,

  -- Client Information
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,

  -- Report Content (JSON strings)
  scope_of_works_json TEXT,
  methodology_json TEXT,
  findings_json TEXT,
  conclusions_json TEXT,
  recommendations_json TEXT,

  -- Sign-off
  declaration_signed INTEGER NOT NULL DEFAULT 0,
  signed_at TEXT,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  last_sync_error TEXT
);

-- Roof Elements (mirrors Prisma RoofElement model)
CREATE TABLE IF NOT EXISTS roof_elements (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,

  element_type TEXT NOT NULL,
  location TEXT NOT NULL,
  cladding_type TEXT,
  material TEXT,
  manufacturer TEXT,
  pitch REAL,
  area REAL,
  condition_rating TEXT,
  condition_notes TEXT,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Defects (mirrors Prisma Defect model)
CREATE TABLE IF NOT EXISTS defects (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  roof_element_id TEXT,

  defect_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,

  classification TEXT NOT NULL,
  severity TEXT NOT NULL,

  -- Three-part structure (ISO compliant)
  observation TEXT NOT NULL,
  analysis TEXT,
  opinion TEXT,

  code_reference TEXT,
  cop_reference TEXT,

  recommendation TEXT,
  priority_level TEXT,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (roof_element_id) REFERENCES roof_elements(id) ON DELETE SET NULL
);

-- Photos (mirrors Prisma Photo model with local file tracking)
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  defect_id TEXT,
  roof_element_id TEXT,

  -- Local file info
  local_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  photo_type TEXT NOT NULL,
  quick_tag TEXT,

  -- EXIF Metadata (critical for evidence)
  captured_at TEXT,
  gps_lat REAL,
  gps_lng REAL,
  gps_altitude REAL,
  gps_accuracy REAL,
  camera_make TEXT,
  camera_model TEXT,
  exposure_time REAL,
  f_number REAL,
  iso INTEGER,
  focal_length REAL,

  -- Evidence integrity
  original_hash TEXT NOT NULL,

  -- Annotations
  annotations_json TEXT,
  annotated_uri TEXT,

  -- Measurements
  measurements_json TEXT,
  calibration_json TEXT,
  measured_uri TEXT,

  caption TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'captured',
  uploaded_url TEXT,
  synced_at TEXT,
  last_sync_error TEXT,

  created_at TEXT NOT NULL,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE SET NULL,
  FOREIGN KEY (roof_element_id) REFERENCES roof_elements(id) ON DELETE SET NULL
);

-- Voice Notes (audio recordings for observations)
CREATE TABLE IF NOT EXISTS voice_notes (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  defect_id TEXT,
  roof_element_id TEXT,

  -- File info
  local_uri TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,

  -- Metadata
  recorded_at TEXT NOT NULL,
  transcription TEXT,

  -- Evidence integrity
  original_hash TEXT,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'draft',
  uploaded_url TEXT,
  synced_at TEXT,
  last_sync_error TEXT,

  created_at TEXT NOT NULL,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE SET NULL,
  FOREIGN KEY (roof_element_id) REFERENCES roof_elements(id) ON DELETE SET NULL
);

-- Videos (walkthrough recordings)
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  defect_id TEXT,
  roof_element_id TEXT,

  -- File info
  local_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,

  -- Metadata
  title TEXT,
  description TEXT,
  recorded_at TEXT NOT NULL,

  -- GPS
  gps_lat REAL,
  gps_lng REAL,

  -- Evidence integrity
  original_hash TEXT,

  -- GPS track (JSON array of coordinates during recording)
  gps_track_json TEXT,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'draft',
  uploaded_url TEXT,
  synced_at TEXT,
  last_sync_error TEXT,

  created_at TEXT NOT NULL,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE SET NULL,
  FOREIGN KEY (roof_element_id) REFERENCES roof_elements(id) ON DELETE SET NULL
);

-- Compliance Assessments (mirrors Prisma ComplianceAssessment model)
CREATE TABLE IF NOT EXISTS compliance_assessments (
  id TEXT PRIMARY KEY,
  report_id TEXT UNIQUE NOT NULL,

  checklist_results_json TEXT NOT NULL,
  non_compliance_summary TEXT,

  -- Sync tracking
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Checklists (downloaded from server)
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  standard TEXT,
  items_json TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Templates (downloaded from server)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  inspection_type TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  checklists_json TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  downloaded_at TEXT NOT NULL
);

-- Sync Queue (tracks what needs uploading)
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- ============================================
-- INDICES for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reports_sync_status ON reports(sync_status);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON reports(updated_at);

CREATE INDEX IF NOT EXISTS idx_roof_elements_report_id ON roof_elements(report_id);
CREATE INDEX IF NOT EXISTS idx_roof_elements_sync_status ON roof_elements(sync_status);

CREATE INDEX IF NOT EXISTS idx_defects_report_id ON defects(report_id);
CREATE INDEX IF NOT EXISTS idx_defects_roof_element_id ON defects(roof_element_id);
CREATE INDEX IF NOT EXISTS idx_defects_sync_status ON defects(sync_status);

CREATE INDEX IF NOT EXISTS idx_photos_report_id ON photos(report_id);
CREATE INDEX IF NOT EXISTS idx_photos_defect_id ON photos(defect_id);
CREATE INDEX IF NOT EXISTS idx_photos_roof_element_id ON photos(roof_element_id);
CREATE INDEX IF NOT EXISTS idx_photos_sync_status ON photos(sync_status);

CREATE INDEX IF NOT EXISTS idx_voice_notes_report_id ON voice_notes(report_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_defect_id ON voice_notes(defect_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_sync_status ON voice_notes(sync_status);

CREATE INDEX IF NOT EXISTS idx_videos_report_id ON videos(report_id);
CREATE INDEX IF NOT EXISTS idx_videos_defect_id ON videos(defect_id);
CREATE INDEX IF NOT EXISTS idx_videos_sync_status ON videos(sync_status);

CREATE INDEX IF NOT EXISTS idx_compliance_report_id ON compliance_assessments(report_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_checklists_standard ON checklists(standard);
CREATE INDEX IF NOT EXISTS idx_checklists_category ON checklists(category);

-- Audit Log (tracks system activity)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
`;

// ============================================
// MIGRATION SCRIPTS
// ============================================

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 2,
    sql: `
      -- Migration from v1 to v2: Restructure to match Prisma schema
      -- This is a destructive migration - data will need to be re-synced

      -- Drop old tables if they exist
      DROP TABLE IF EXISTS report_drafts;
      DROP TABLE IF EXISTS compliance_results;

      -- Rename indices if needed (handled by CREATE IF NOT EXISTS above)
    `,
  },
  {
    version: 3,
    sql: `
      -- Migration from v2 to v3: Add quick_tag column to photos
      ALTER TABLE photos ADD COLUMN quick_tag TEXT;
    `,
  },
  {
    version: 4,
    sql: `
      -- Migration from v3 to v4: Add voice_notes table
      CREATE TABLE IF NOT EXISTS voice_notes (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        defect_id TEXT,
        roof_element_id TEXT,
        local_uri TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        transcription TEXT,
        sync_status TEXT NOT NULL DEFAULT 'draft',
        uploaded_url TEXT,
        synced_at TEXT,
        last_sync_error TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE SET NULL,
        FOREIGN KEY (roof_element_id) REFERENCES roof_elements(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_voice_notes_report_id ON voice_notes(report_id);
      CREATE INDEX IF NOT EXISTS idx_voice_notes_defect_id ON voice_notes(defect_id);
      CREATE INDEX IF NOT EXISTS idx_voice_notes_sync_status ON voice_notes(sync_status);
    `,
  },
  {
    version: 5,
    sql: `
      -- Migration from v4 to v5: Add annotations columns to photos
      ALTER TABLE photos ADD COLUMN annotations_json TEXT;
      ALTER TABLE photos ADD COLUMN annotated_uri TEXT;
    `,
  },
  {
    version: 6,
    sql: `
      -- Migration from v5 to v6: Add videos table
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        defect_id TEXT,
        roof_element_id TEXT,
        local_uri TEXT NOT NULL,
        thumbnail_uri TEXT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        title TEXT,
        description TEXT,
        recorded_at TEXT NOT NULL,
        gps_lat REAL,
        gps_lng REAL,
        sync_status TEXT NOT NULL DEFAULT 'draft',
        uploaded_url TEXT,
        synced_at TEXT,
        last_sync_error TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE SET NULL,
        FOREIGN KEY (roof_element_id) REFERENCES roof_elements(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_videos_report_id ON videos(report_id);
      CREATE INDEX IF NOT EXISTS idx_videos_defect_id ON videos(defect_id);
      CREATE INDEX IF NOT EXISTS idx_videos_sync_status ON videos(sync_status);
    `,
  },
  {
    version: 7,
    sql: `
      -- Migration from v6 to v7: Add measurements columns to photos
      ALTER TABLE photos ADD COLUMN measurements_json TEXT;
      ALTER TABLE photos ADD COLUMN calibration_json TEXT;
      ALTER TABLE photos ADD COLUMN measured_uri TEXT;
    `,
  },
  {
    version: 8,
    sql: `
      -- Migration from v7 to v8: Add audit_log table
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    `,
  },
  {
    version: 9,
    sql: `
      -- Migration from v8 to v9: Add video evidence integrity columns
      ALTER TABLE videos ADD COLUMN original_hash TEXT;
      ALTER TABLE videos ADD COLUMN gps_track_json TEXT;
    `,
  },
  {
    version: 10,
    sql: `
      -- Migration from v9 to v10: Add voice note evidence integrity column
      ALTER TABLE voice_notes ADD COLUMN original_hash TEXT;
    `,
  },
];
