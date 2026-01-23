/**
 * Local SQLite Database Types
 * Types for offline-first storage on mobile device
 */

import type {
  InspectionType,
  PropertyType,
  ReportStatus,
  PhotoType,
  DefectClass,
  DefectSeverity,
  ElementType,
  SyncStatus,
  PhotoSyncStatus,
  ComplianceStatus,
} from "./shared";

// ============================================
// LOCAL DATABASE RECORD TYPES
// ============================================

export interface LocalUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: string;
  qualifications: string | null;
  lbpNumber: string | null;
  syncedAt: string | null;
}

export interface LocalReportDraft {
  id: string;
  reportId: string | null; // null if not yet synced to server
  reportNumber: string | null;

  // Property Details
  propertyAddress: string;
  propertyCity: string;
  propertyRegion: string;
  propertyPostcode: string;
  propertyType: PropertyType;
  buildingAge: number | null;

  // Client Details
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;

  // Inspection Details
  inspectionDate: string;
  inspectionType: InspectionType;
  weatherConditions: string | null;
  accessMethod: string | null;
  limitations: string | null;

  // Report Content
  executiveSummary: string | null;
  conclusions: string | null;

  // Status
  status: ReportStatus;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  lastSyncError: string | null;
}

export interface LocalPhoto {
  id: string;
  localId: string; // Unique ID generated locally
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;

  // Local file info
  localUri: string;
  thumbnailUri: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;

  photoType: PhotoType;

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

  caption: string | null;
  sortOrder: number;

  // Sync tracking
  status: PhotoSyncStatus;
  uploadedUrl: string | null;
  syncedAt: string | null;
  lastSyncError: string | null;

  createdAt: string;
}

export interface LocalDefect {
  id: string;
  localId: string;
  reportId: string;
  roofElementId: string | null;

  defectNumber: number;
  title: string;
  description: string;
  location: string;

  classification: DefectClass;
  severity: DefectSeverity;

  observation: string;
  analysis: string | null;
  opinion: string | null;

  codeReference: string | null;
  copReference: string | null;

  recommendation: string | null;
  priorityLevel: string | null;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalRoofElement {
  id: string;
  localId: string;
  reportId: string;

  elementType: ElementType;
  name: string;
  material: string | null;
  manufacturer: string | null;
  condition: string | null;
  age: number | null;
  area: number | null;
  notes: string | null;

  // Sync tracking
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalComplianceAssessment {
  id: string;
  localId: string;
  reportId: string;

  // Stored as JSON string
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
  version: string;
  category: string;
  standard: string;
  definition: string; // JSON string of checklist definition
  downloadedAt: string;
}

export interface LocalComplianceResult {
  id: string;
  reportId: string;
  checklistId: string;
  itemRef: string;
  itemDescription: string;
  status: ComplianceStatus;
  notes: string | null;
  evidencePhotoIds: string | null; // JSON array of photo IDs
  assessedAt: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LocalTemplate {
  id: string;
  name: string;
  description: string | null;
  inspectionType: InspectionType;
  sectionsJson: string; // JSON string of string[]
  checklistsJson: string | null;
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

// ============================================
// DATABASE SCHEMA CREATION
// ============================================

export const DATABASE_NAME = "ranz_mobile.db";
export const DATABASE_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- Users (for offline auth state)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  qualifications TEXT,
  lbp_number TEXT,
  synced_at TEXT
);

-- Report Drafts (local report drafts)
CREATE TABLE IF NOT EXISTS report_drafts (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  report_number TEXT,
  property_address TEXT NOT NULL,
  property_city TEXT NOT NULL,
  property_region TEXT NOT NULL,
  property_postcode TEXT NOT NULL,
  property_type TEXT NOT NULL,
  building_age INTEGER,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  inspection_date TEXT NOT NULL,
  inspection_type TEXT NOT NULL,
  weather_conditions TEXT,
  access_method TEXT,
  limitations TEXT,
  executive_summary TEXT,
  conclusions TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  last_sync_error TEXT
);

-- Photos (local photo cache)
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  local_id TEXT UNIQUE NOT NULL,
  report_id TEXT NOT NULL,
  defect_id TEXT,
  roof_element_id TEXT,
  local_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  photo_type TEXT NOT NULL,
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
  original_hash TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'captured',
  uploaded_url TEXT,
  synced_at TEXT,
  last_sync_error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES report_drafts(id) ON DELETE CASCADE
);

-- Defects
CREATE TABLE IF NOT EXISTS defects (
  id TEXT PRIMARY KEY,
  local_id TEXT UNIQUE NOT NULL,
  report_id TEXT NOT NULL,
  roof_element_id TEXT,
  defect_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  classification TEXT NOT NULL,
  severity TEXT NOT NULL,
  observation TEXT NOT NULL,
  analysis TEXT,
  opinion TEXT,
  code_reference TEXT,
  cop_reference TEXT,
  recommendation TEXT,
  priority_level TEXT,
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (report_id) REFERENCES report_drafts(id) ON DELETE CASCADE
);

-- Roof Elements
CREATE TABLE IF NOT EXISTS roof_elements (
  id TEXT PRIMARY KEY,
  local_id TEXT UNIQUE NOT NULL,
  report_id TEXT NOT NULL,
  element_type TEXT NOT NULL,
  name TEXT NOT NULL,
  material TEXT,
  manufacturer TEXT,
  condition TEXT,
  age INTEGER,
  area REAL,
  notes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (report_id) REFERENCES report_drafts(id) ON DELETE CASCADE
);

-- Compliance Assessments
CREATE TABLE IF NOT EXISTS compliance_assessments (
  id TEXT PRIMARY KEY,
  local_id TEXT UNIQUE NOT NULL,
  report_id TEXT UNIQUE NOT NULL,
  checklist_results_json TEXT NOT NULL,
  non_compliance_summary TEXT,
  sync_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (report_id) REFERENCES report_drafts(id) ON DELETE CASCADE
);

-- Checklists (downloaded from server)
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  category TEXT NOT NULL,
  standard TEXT NOT NULL,
  definition TEXT NOT NULL,
  downloaded_at TEXT NOT NULL
);

-- Compliance Results (individual item assessments)
CREATE TABLE IF NOT EXISTS compliance_results (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  checklist_id TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  item_description TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  evidence_photo_ids TEXT,
  assessed_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES report_drafts(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_id) REFERENCES checklists(id)
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

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_photos_report_id ON photos(report_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_defects_report_id ON defects(report_id);
CREATE INDEX IF NOT EXISTS idx_roof_elements_report_id ON roof_elements(report_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_report_drafts_sync_status ON report_drafts(sync_status);
CREATE INDEX IF NOT EXISTS idx_compliance_results_report ON compliance_results(report_id);
CREATE INDEX IF NOT EXISTS idx_compliance_results_checklist ON compliance_results(checklist_id);
`;
