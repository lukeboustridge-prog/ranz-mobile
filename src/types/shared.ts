/**
 * Shared Types between Backend (Next.js) and Mobile (React Native)
 * These types MUST remain in sync with the Prisma schema on the backend.
 *
 * Last synced with: prisma/schema.prisma
 */

// ============================================
// ENUMS - Must match Prisma enums exactly
// ============================================

export enum UserRole {
  INSPECTOR = "INSPECTOR",
  REVIEWER = "REVIEWER",
  ADMIN = "ADMIN",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
}

export enum ReportStatus {
  DRAFT = "DRAFT",
  IN_PROGRESS = "IN_PROGRESS",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  FINALISED = "FINALISED",
}

export enum PropertyType {
  RESIDENTIAL_1 = "RESIDENTIAL_1",
  RESIDENTIAL_2 = "RESIDENTIAL_2",
  RESIDENTIAL_3 = "RESIDENTIAL_3",
  COMMERCIAL_LOW = "COMMERCIAL_LOW",
  COMMERCIAL_HIGH = "COMMERCIAL_HIGH",
  INDUSTRIAL = "INDUSTRIAL",
}

export enum InspectionType {
  FULL_INSPECTION = "FULL_INSPECTION",
  VISUAL_ONLY = "VISUAL_ONLY",
  NON_INVASIVE = "NON_INVASIVE",
  INVASIVE = "INVASIVE",
  DISPUTE_RESOLUTION = "DISPUTE_RESOLUTION",
  PRE_PURCHASE = "PRE_PURCHASE",
  MAINTENANCE_REVIEW = "MAINTENANCE_REVIEW",
}

export enum ElementType {
  ROOF_CLADDING = "ROOF_CLADDING",
  RIDGE = "RIDGE",
  VALLEY = "VALLEY",
  HIP = "HIP",
  BARGE = "BARGE",
  FASCIA = "FASCIA",
  GUTTER = "GUTTER",
  DOWNPIPE = "DOWNPIPE",
  FLASHING_WALL = "FLASHING_WALL",
  FLASHING_PENETRATION = "FLASHING_PENETRATION",
  SKYLIGHT = "SKYLIGHT",
  VENT = "VENT",
  OTHER = "OTHER",
}

export enum ConditionRating {
  GOOD = "GOOD",
  FAIR = "FAIR",
  POOR = "POOR",
  CRITICAL = "CRITICAL",
  NOT_INSPECTED = "NOT_INSPECTED",
}

export enum DefectClass {
  MAJOR_DEFECT = "MAJOR_DEFECT",
  MINOR_DEFECT = "MINOR_DEFECT",
  SAFETY_HAZARD = "SAFETY_HAZARD",
  MAINTENANCE_ITEM = "MAINTENANCE_ITEM",
  WORKMANSHIP_ISSUE = "WORKMANSHIP_ISSUE",
}

export enum DefectSeverity {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum PriorityLevel {
  IMMEDIATE = "IMMEDIATE",
  SHORT_TERM = "SHORT_TERM",
  MEDIUM_TERM = "MEDIUM_TERM",
  LONG_TERM = "LONG_TERM",
}

export enum PhotoType {
  OVERVIEW = "OVERVIEW",
  CONTEXT = "CONTEXT",
  DETAIL = "DETAIL",
  SCALE_REFERENCE = "SCALE_REFERENCE",
  INACCESSIBLE = "INACCESSIBLE",
  EQUIPMENT = "EQUIPMENT",
  GENERAL = "GENERAL",
}

export enum QuickTag {
  DEFECT = "DEFECT",
  GOOD = "GOOD",
  INACCESSIBLE = "INACCESSIBLE",
}

export enum ComplianceStatus {
  PASS = "PASS",
  FAIL = "FAIL",
  PARTIAL = "PARTIAL",
  NOT_APPLICABLE = "NOT_APPLICABLE",
  NOT_INSPECTED = "NOT_INSPECTED",
}

// ============================================
// INTERFACES - Match Prisma models
// ============================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  company: string | null;
  address: string | null;
  qualifications: string | null;
  lbpNumber: string | null;
  yearsExperience: number | null;
  specialisations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  reportNumber: string; // RANZ-YYYY-NNNNN
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

  // Report Content (JSON fields)
  scopeOfWorks: Record<string, unknown> | null;
  methodology: Record<string, unknown> | null;
  findings: Record<string, unknown> | null;
  conclusions: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;

  // Sign-off
  declarationSigned: boolean;
  signedAt: string | null;

  // PDF
  pdfUrl: string | null;
  pdfGeneratedAt: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;

  // Relations
  inspectorId: string;
  inspector?: User;
  photos?: Photo[];
  defects?: Defect[];
  roofElements?: RoofElement[];
  complianceAssessment?: ComplianceAssessment | null;
}

export interface RoofElement {
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

  createdAt: string;
  updatedAt: string;

  // Relations
  defects?: Defect[];
  photos?: Photo[];
}

export interface Defect {
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

  codeReference: string | null; // E2/AS1 Section X
  copReference: string | null; // COP v25.12 Section X

  recommendation: string | null;
  priorityLevel: PriorityLevel | null;

  createdAt: string;
  updatedAt: string;

  // Relations
  photos?: Photo[];
  roofElement?: RoofElement | null;
}

export interface Photo {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;

  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl: string | null;

  photoType: PhotoType;

  // EXIF Metadata (critical for evidence)
  capturedAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  cameraMake: string | null;
  cameraModel: string | null;

  // Evidence Integrity
  originalHash: string;
  hashVerified: boolean;

  caption: string | null;
  sortOrder: number;

  createdAt: string;
}

export interface ComplianceAssessment {
  id: string;
  reportId: string;

  // Results for each checklist: {e2_as1: {item_1: "PASS", ...}, ...}
  checklistResults: Record<string, Record<string, ComplianceStatus>>;
  nonComplianceSummary: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  reportId: string;
  action: string;
  userId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  inspectionType: InspectionType;
  sections: string[];
  checklists: { compliance?: string[] } | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  name: string;
  category: string;
  standard: string | null;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  section: string;
  item: string;
  description: string;
  required?: boolean;
  notes?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BootstrapResponse {
  user: User;
  checklists: Checklist[];
  templates: ReportTemplate[];
  recentReports: ReportSummary[];
  lastSyncAt: string;
}

export interface ReportSummary {
  id: string;
  reportNumber: string;
  propertyAddress: string;
  propertyCity: string;
  inspectionType: InspectionType;
  status: ReportStatus;
  inspectorId?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  defectCount: number;
  // Full related data included in bootstrap down-sync
  photos?: DownloadedPhoto[];
  defects?: DownloadedDefect[];
  roofElements?: DownloadedRoofElement[];
  complianceAssessment?: DownloadedComplianceAssessment | null;
}

// ============================================
// DOWNLOAD TYPES (Server → Mobile)
// ============================================

export interface DownloadedPhoto {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl: string | null;
  photoType: PhotoType;
  capturedAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAltitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  exposureTime: string | null;
  fNumber: number | null;
  iso: number | null;
  focalLength: number | null;
  originalHash: string;
  caption: string | null;
  annotations: unknown | null;
  annotatedUrl: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface DownloadedDefect {
  id: string;
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
  priorityLevel: PriorityLevel | null;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadedRoofElement {
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
  createdAt: string;
  updatedAt: string;
}

export interface DownloadedComplianceAssessment {
  id: string;
  reportId: string;
  checklistResults: Record<string, Record<string, ComplianceStatus>>;
  nonComplianceSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SYNC TYPES
// ============================================

export type SyncOperation = "create" | "update" | "delete";

export interface SyncQueueItem {
  id: number;
  entityType: "report" | "photo" | "defect" | "element" | "compliance";
  entityId: string;
  operation: SyncOperation;
  payload: string;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
}

export type SyncStatus = "draft" | "pending" | "processing" | "synced" | "error";

export type PhotoSyncStatus = "captured" | "pending" | "processing" | "uploaded" | "synced" | "error";

// ============================================
// SYNC UPLOAD TYPES (match server endpoint)
// ============================================

export interface SyncUploadPayload {
  reports: ReportSync[];
  deviceId: string;
  syncTimestamp: string;
}

export interface ReportSync {
  id: string;
  reportNumber: string;
  status: ReportStatus;
  propertyAddress: string;
  propertyCity: string;
  propertyRegion: string;
  propertyPostcode: string;
  propertyType: PropertyType;
  buildingAge: number | null;
  gpsLat: number | null;
  gpsLng: number | null;
  inspectionDate: string;
  inspectionType: InspectionType;
  weatherConditions: string | null;
  accessMethod: string | null;
  limitations: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  scopeOfWorks: Record<string, unknown> | null;
  methodology: Record<string, unknown> | null;
  findings: Record<string, unknown> | null;
  conclusions: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  declarationSigned: boolean;
  signedAt: string | null;
  clientUpdatedAt: string;
  elements?: RoofElementSync[];
  defects?: DefectSync[];
  compliance?: ComplianceAssessmentSync | null;
  photoMetadata?: PhotoMetadataSync[];
}

export interface RoofElementSync {
  id: string;
  elementType: ElementType;
  location: string;
  claddingType: string | null;
  material: string | null;
  manufacturer: string | null;
  pitch: number | null;
  area: number | null;
  conditionRating: ConditionRating | null;
  conditionNotes: string | null;
  clientUpdatedAt?: string;
  _deleted?: boolean;
}

export interface DefectSync {
  id: string;
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
  priorityLevel: PriorityLevel | null;
  roofElementId: string | null;
  clientUpdatedAt?: string;
  _deleted?: boolean;
}

export interface ComplianceAssessmentSync {
  id: string;
  checklistResults: Record<string, Record<string, ComplianceStatus>>;
  nonComplianceSummary: string | null;
  clientUpdatedAt?: string;
}

export interface PhotoMetadataSync {
  id: string;
  photoType: PhotoType;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  capturedAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  originalHash: string;
  caption: string | null;
  sortOrder: number;
  defectId: string | null;
  roofElementId: string | null;
  needsUpload?: boolean;
  clientUpdatedAt?: string;
  _deleted?: boolean;
}

export interface SyncUploadResponse {
  success: boolean;
  timestamp: string;
  processingTimeMs: number;
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    conflicts: number;
  };
  results: {
    syncedReports: string[];
    failedReports: { reportId: string; error: string }[];
    conflicts: {
      reportId: string;
      resolution: string;
      serverUpdatedAt: string;
      clientUpdatedAt: string;
    }[];
    pendingPhotoUploads: {
      reportId: string;
      photoId: string;
      uploadUrl: string;
    }[];
  };
}
