/**
 * Theme Constants
 * Centralized color and style tokens for consistent UI
 */

// ============================================
// BRAND COLORS
// ============================================

export const COLORS = {
  // Primary - RANZ Blue
  primary: {
    900: "#0c1929",
    800: "#142942",
    700: "#1c3a5c",
    600: "#254b75",
    500: "#2d5c8f", // Primary
    400: "#4a7ab0",
    300: "#7199c4",
    200: "#a3bed9",
    100: "#d1deed",
    50: "#e8eef6",
  },

  // Accent - Safety Orange
  accent: {
    500: "#e65100",
    400: "#ff6d00",
    300: "#ff9e40",
  },

  // Neutrals
  gray: {
    900: "#111827",
    800: "#1f2937",
    700: "#374151",
    600: "#4b5563",
    500: "#6b7280",
    400: "#9ca3af",
    300: "#d1d5db",
    200: "#e5e7eb",
    100: "#f3f4f6",
    50: "#f9fafb",
  },

  // Semantic
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

// ============================================
// STATUS COLORS
// ============================================

export const STATUS_COLORS = {
  // Report Status
  DRAFT: "#6b7280",
  IN_PROGRESS: "#2563eb",
  PENDING_REVIEW: "#d97706",
  APPROVED: "#059669",
  FINALISED: "#7c3aed",

  // Sync Status
  draft: "#6b7280",
  pending: "#d97706",
  synced: "#059669",
  error: "#dc2626",
} as const;

export const STATUS_BACKGROUNDS = {
  // Report Status
  DRAFT: "#f3f4f6",
  IN_PROGRESS: "#dbeafe",
  PENDING_REVIEW: "#fef3c7",
  APPROVED: "#d1fae5",
  FINALISED: "#ede9fe",

  // Sync Status
  draft: "#f3f4f6",
  pending: "#fef3c7",
  synced: "#d1fae5",
  error: "#fee2e2",
} as const;

// ============================================
// SEVERITY COLORS
// ============================================

export const SEVERITY_COLORS = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#16a34a",
} as const;

export const SEVERITY_BACKGROUNDS = {
  CRITICAL: "#fee2e2",
  HIGH: "#ffedd5",
  MEDIUM: "#fef9c3",
  LOW: "#dcfce7",
} as const;

// ============================================
// CONDITION COLORS
// ============================================

export const CONDITION_COLORS = {
  GOOD: "#16a34a",
  FAIR: "#ca8a04",
  POOR: "#ea580c",
  CRITICAL: "#dc2626",
  NOT_INSPECTED: "#6b7280",
} as const;

export const CONDITION_BACKGROUNDS = {
  GOOD: "#dcfce7",
  FAIR: "#fef9c3",
  POOR: "#ffedd5",
  CRITICAL: "#fee2e2",
  NOT_INSPECTED: "#f3f4f6",
} as const;

// ============================================
// CLASSIFICATION COLORS
// ============================================

export const CLASSIFICATION_COLORS = {
  MAJOR_DEFECT: "#dc2626",
  MINOR_DEFECT: "#d97706",
  SAFETY_HAZARD: "#7c2d12",
  MAINTENANCE_ITEM: "#2563eb",
} as const;

export const CLASSIFICATION_BACKGROUNDS = {
  MAJOR_DEFECT: "#fee2e2",
  MINOR_DEFECT: "#fef3c7",
  SAFETY_HAZARD: "#fef2f2",
  MAINTENANCE_ITEM: "#dbeafe",
} as const;

// ============================================
// COMPLIANCE COLORS
// ============================================

export const COMPLIANCE_COLORS = {
  PASS: "#16a34a",
  FAIL: "#dc2626",
  PARTIAL: "#d97706",
  NOT_APPLICABLE: "#6b7280",
  NOT_INSPECTED: "#9ca3af",
} as const;

export const COMPLIANCE_BACKGROUNDS = {
  PASS: "#dcfce7",
  FAIL: "#fee2e2",
  PARTIAL: "#fef3c7",
  NOT_APPLICABLE: "#f3f4f6",
  NOT_INSPECTED: "#f9fafb",
} as const;

// ============================================
// ROLE COLORS
// ============================================

export const ROLE_COLORS = {
  ADMIN: "#dc2626",
  REVIEWER: "#7c3aed",
  INSPECTOR: "#2d5c8f",
} as const;

export const ROLE_BACKGROUNDS = {
  ADMIN: "#fee2e2",
  REVIEWER: "#ede9fe",
  INSPECTOR: "#dbeafe",
} as const;

// ============================================
// GPS ACCURACY COLORS
// ============================================

export const GPS_COLORS = {
  good: "#16a34a",
  fair: "#d97706",
  poor: "#dc2626",
  none: "#6b7280",
} as const;

// ============================================
// PHOTO TYPE COLORS
// ============================================

export const PHOTO_TYPE_COLORS = {
  OVERVIEW: "#2563eb",
  CONTEXT: "#7c3aed",
  DETAIL: "#dc2626",
  SCALE_REFERENCE: "#059669",
  GENERAL: "#6b7280",
} as const;

// ============================================
// SPACING
// ============================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

// ============================================
// TOUCH TARGETS (WCAG compliant)
// ============================================

export const TOUCH_TARGET = {
  minimum: 44, // WCAG minimum
  recommended: 48, // Recommended for mobile
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ============================================
// FONT SIZES
// ============================================

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || COLORS.gray[500];
}

export function getStatusBackground(status: string): string {
  return STATUS_BACKGROUNDS[status as keyof typeof STATUS_BACKGROUNDS] || COLORS.gray[100];
}

export function getSeverityColor(severity: string): string {
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || COLORS.gray[500];
}

export function getSeverityBackground(severity: string): string {
  return SEVERITY_BACKGROUNDS[severity as keyof typeof SEVERITY_BACKGROUNDS] || COLORS.gray[100];
}

export function getConditionColor(condition: string): string {
  return CONDITION_COLORS[condition as keyof typeof CONDITION_COLORS] || COLORS.gray[500];
}

export function getConditionBackground(condition: string): string {
  return CONDITION_BACKGROUNDS[condition as keyof typeof CONDITION_BACKGROUNDS] || COLORS.gray[100];
}

export function getComplianceColor(status: string): string {
  return COMPLIANCE_COLORS[status as keyof typeof COMPLIANCE_COLORS] || COLORS.gray[500];
}

export function getGpsColor(status: string): string {
  return GPS_COLORS[status as keyof typeof GPS_COLORS] || COLORS.gray[500];
}

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role as keyof typeof ROLE_COLORS] || COLORS.gray[500];
}

export function getRoleBackground(role: string): string {
  return ROLE_BACKGROUNDS[role as keyof typeof ROLE_BACKGROUNDS] || COLORS.gray[100];
}
