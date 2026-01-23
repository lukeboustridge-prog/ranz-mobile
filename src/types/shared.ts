/**
 * Shared Types between Backend (Next.js) and Mobile (React Native)
 * These types MUST remain in sync with the backend to prevent serialization issues during sync.
 */

// ============================================
// ENUMS
// ============================================

export enum InspectionType {
  FULL_INSPECTION = "FULL_INSPECTION",
  VISUAL_ONLY = "VISUAL_ONLY",
  NON_INVASIVE = "NON_INVASIVE",
  INVASIVE = "INVASIVE",
  DISPUTE_RESOLUTION = "DISPUTE_RESOLUTION",
  PRE_PURCHASE = "PRE_PURCHASE",
  MAINTENANCE_REVIEW = "MAINTENANCE_REVIEW",
}

export enum PropertyType {
  RESIDENTIAL_1 = "RESIDENTIAL_1",
  RESIDENTIAL_2 = "RESIDENTIAL_2",
  RESIDENTIAL_3 = "RESIDENTIAL_3",
  COMMERCIAL_LOW = "COMMERCIAL_LOW",
  COMMERCIAL_HIGH = "COMMERCIAL_HIGH",
  INDUSTRIAL = "INDUSTRIAL",
}

export enum DefectSeverity {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum DefectClass {
  WEATHERTIGHTNESS = "WEATHERTIGHTNESS",
  STRUCTURAL = "STRUCTURAL",
  MATERIAL_FAILURE = "MATERIAL_FAILURE",
  WORKMANSHIP = "WORKMANSHIP",
  MAINTENANCE = "MAINTENANCE",
  DESIGN = "DESIGN",
  CODE_COMPLIANCE = "CODE_COMPLIANCE",
}

export enum ElementType {
  ROOF_CLADDING = "ROOF_CLADDING",
  FLASHING = "FLASHING",
  GUTTER = "GUTTER",
  DOWNPIPE = "DOWNPIPE",
  FASCIA = "FASCIA",
  SOFFIT = "SOFFIT",
  RIDGE = "RIDGE",
  VALLEY = "VALLEY",
  HIP = "HIP",
  PENETRATION = "PENETRATION",
  SKYLIGHT = "SKYLIGHT",
  VENTILATION = "VENTILATION",
  PARAPET = "PARAPET",
  MEMBRANE = "MEMBRANE",
  COATING = "COATING",
  OTHER = "OTHER",
}

export enum PhotoType {
  OVERVIEW = "OVERVIEW",
  CONTEXT = "CONTEXT",
  DETAIL = "DETAIL",
  SCALE_REFERENCE = "SCALE_REFERENCE",
  BEFORE = "BEFORE",
  AFTER = "AFTER",
}

export enum ReportStatus {
  DRAFT = "DRAFT",
  IN_PROGRESS = "IN_PROGRESS",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  FINALISED = "FINALISED",
}

export type ComplianceStatus = "pass" | "fail" | "partial" | "na";

// ============================================
// INTERFACES
// ============================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: "INSPECTOR" | "ADMIN";
  qualifications: string | null;
  lbpNumber: string | null;
  yearsExperience: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  reportNumber: string;
  inspectorId: string;

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
  clientCompany: string | null;

  // Inspection Details
  inspectionDate: string;
  inspectionType: InspectionType;
  weatherConditions: string | null;
  accessMethod: string | null;
  limitations: string | null;

  // Report Content
  executiveSummary: string | null;
  scopeOfWork: string | null;
  conclusions: string | null;
  recommendations: string | null;

  // Status
  status: ReportStatus;
  pdfGeneratedAt: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Relations (populated when needed)
  inspector?: User;
  roofElements?: RoofElement[];
  defects?: Defect[];
  photos?: Photo[];
  complianceAssessment?: ComplianceAssessment | null;
}

export interface RoofElement {
  id: string;
  reportId: string;

  elementType: ElementType;
  name: string;
  material: string | null;
  manufacturer: string | null;
  condition: string | null;
  age: number | null;
  area: number | null;
  notes: string | null;

  createdAt: string;
  updatedAt: string;

  // Relations
  photos?: Photo[];
  defects?: Defect[];
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

  observation: string;
  analysis: string | null;
  opinion: string | null;

  codeReference: string | null;
  copReference: string | null;

  recommendation: string | null;
  priorityLevel: string | null;
  estimatedCost: number | null;

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

  checklistResults: {
    [checklistKey: string]: {
      [itemId: string]: ComplianceStatus;
    };
  };

  nonComplianceSummary: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  section: string;
  item: string;
  description: string;
  required: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  category: string;
  standard: string;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  inspectionType: InspectionType;
  sections: string[];
  checklists: {
    compliance?: string[];
  } | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  defectCount: number;
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

export type SyncStatus = "draft" | "pending" | "synced" | "error";

export type PhotoSyncStatus = "captured" | "processing" | "uploaded" | "synced";
