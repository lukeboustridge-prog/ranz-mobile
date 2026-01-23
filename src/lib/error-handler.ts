/**
 * Error Handler Utility
 * Centralized error handling with consistent user feedback
 */

import { Alert, Platform } from "react-native";
import { appLogger } from "./logger";

// ============================================
// TYPES
// ============================================

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export type ErrorCode =
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "PERMISSION_ERROR"
  | "CAMERA_ERROR"
  | "LOCATION_ERROR"
  | "STORAGE_ERROR"
  | "SYNC_ERROR"
  | "UNKNOWN_ERROR";

// ============================================
// ERROR MESSAGES
// ============================================

const ERROR_MESSAGES: Record<ErrorCode, { title: string; message: string }> = {
  NETWORK_ERROR: {
    title: "Connection Error",
    message: "Unable to connect to the server. Please check your internet connection and try again.",
  },
  AUTH_ERROR: {
    title: "Authentication Error",
    message: "Your session has expired. Please sign in again.",
  },
  VALIDATION_ERROR: {
    title: "Invalid Input",
    message: "Please check your input and try again.",
  },
  DATABASE_ERROR: {
    title: "Storage Error",
    message: "Unable to save data locally. Please try again.",
  },
  PERMISSION_ERROR: {
    title: "Permission Required",
    message: "This feature requires additional permissions. Please enable them in Settings.",
  },
  CAMERA_ERROR: {
    title: "Camera Error",
    message: "Unable to access the camera. Please check permissions and try again.",
  },
  LOCATION_ERROR: {
    title: "Location Error",
    message: "Unable to get your location. Please check GPS settings and permissions.",
  },
  STORAGE_ERROR: {
    title: "Storage Error",
    message: "Not enough storage space. Please free up space and try again.",
  },
  SYNC_ERROR: {
    title: "Sync Error",
    message: "Unable to sync data. Your changes are saved locally and will sync when possible.",
  },
  UNKNOWN_ERROR: {
    title: "Something Went Wrong",
    message: "An unexpected error occurred. Please try again.",
  },
};

// ============================================
// ERROR CLASSIFICATION
// ============================================

/**
 * Classify an error into an error code
 */
export function classifyError(error: unknown): ErrorCode {
  if (!error) return "UNKNOWN_ERROR";

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("connection")
  ) {
    return "NETWORK_ERROR";
  }

  // Auth errors
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("401") ||
    errorMessage.includes("auth") ||
    errorMessage.includes("token") ||
    errorMessage.includes("session")
  ) {
    return "AUTH_ERROR";
  }

  // Validation errors
  if (errorMessage.includes("validation") || errorMessage.includes("invalid") || errorMessage.includes("required")) {
    return "VALIDATION_ERROR";
  }

  // Database errors
  if (errorMessage.includes("database") || errorMessage.includes("sqlite") || errorMessage.includes("sql")) {
    return "DATABASE_ERROR";
  }

  // Permission errors
  if (errorMessage.includes("permission") || errorMessage.includes("denied") || errorMessage.includes("not allowed")) {
    return "PERMISSION_ERROR";
  }

  // Camera errors
  if (errorMessage.includes("camera") || errorMessage.includes("capture") || errorMessage.includes("picture")) {
    return "CAMERA_ERROR";
  }

  // Location errors
  if (
    errorMessage.includes("location") ||
    errorMessage.includes("gps") ||
    errorMessage.includes("position") ||
    errorMessage.includes("geolocation")
  ) {
    return "LOCATION_ERROR";
  }

  // Storage errors
  if (
    errorMessage.includes("storage") ||
    errorMessage.includes("disk") ||
    errorMessage.includes("space") ||
    errorMessage.includes("quota")
  ) {
    return "STORAGE_ERROR";
  }

  // Sync errors
  if (errorMessage.includes("sync") || errorMessage.includes("upload") || errorMessage.includes("download")) {
    return "SYNC_ERROR";
  }

  return "UNKNOWN_ERROR";
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Handle an error with logging and optional user notification
 */
export function handleError(
  error: unknown,
  options: {
    context?: string;
    showAlert?: boolean;
    customMessage?: string;
    onDismiss?: () => void;
  } = {}
): AppError {
  const { context = "Operation", showAlert = true, customMessage, onDismiss } = options;

  const errorCode = classifyError(error);
  const errorInfo = ERROR_MESSAGES[errorCode];

  const appError: AppError = {
    code: errorCode,
    message: error instanceof Error ? error.message : String(error),
    userMessage: customMessage || errorInfo.message,
    recoverable: errorCode !== "AUTH_ERROR",
    context: {
      context,
      originalError: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  };

  // Log the error
  appLogger.exception(`${context} failed: ${errorCode}`, error, appError.context);

  // Show user alert if requested
  if (showAlert) {
    Alert.alert(errorInfo.title, appError.userMessage, [{ text: "OK", onPress: onDismiss }]);
  }

  return appError;
}

/**
 * Handle an error silently (log only, no user notification)
 */
export function handleErrorSilent(error: unknown, context?: string): AppError {
  return handleError(error, { context, showAlert: false });
}

/**
 * Create a user-friendly error message for display
 */
export function getUserMessage(error: unknown): string {
  const errorCode = classifyError(error);
  return ERROR_MESSAGES[errorCode].message;
}

// ============================================
// VALIDATION HELPERS
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email) {
    return { valid: true, errors: [] }; // Empty is valid (optional field)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push("Please enter a valid email address");
  }

  if (email.length > 254) {
    errors.push("Email address is too long");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a phone number (NZ format)
 */
export function validatePhone(phone: string): ValidationResult {
  const errors: string[] = [];

  if (!phone) {
    return { valid: true, errors: [] }; // Empty is valid (optional field)
  }

  // Remove spaces and dashes for validation
  const cleaned = phone.replace(/[\s-]/g, "");

  // Check for valid NZ phone formats
  const mobileRegex = /^(\+?64|0)?2\d{7,9}$/;
  const landlineRegex = /^(\+?64|0)?[3-9]\d{6,8}$/;

  if (!mobileRegex.test(cleaned) && !landlineRegex.test(cleaned)) {
    errors.push("Please enter a valid NZ phone number");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a postcode (NZ format - 4 digits)
 */
export function validatePostcode(postcode: string): ValidationResult {
  const errors: string[] = [];

  if (!postcode) {
    return { valid: true, errors: [] }; // Empty is valid (optional field)
  }

  const postcodeRegex = /^\d{4}$/;
  if (!postcodeRegex.test(postcode)) {
    errors.push("Postcode must be 4 digits");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate building age
 */
export function validateBuildingAge(age: string): ValidationResult {
  const errors: string[] = [];

  if (!age) {
    return { valid: true, errors: [] }; // Empty is valid (optional field)
  }

  const ageNum = parseInt(age, 10);

  if (isNaN(ageNum)) {
    errors.push("Building age must be a number");
  } else if (ageNum < 0) {
    errors.push("Building age cannot be negative");
  } else if (ageNum > 200) {
    errors.push("Building age seems too high (max 200 years)");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate required text field
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  const errors: string[] = [];

  if (!value || !value.trim()) {
    errors.push(`${fieldName} is required`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap((r) => r.errors);
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

// ============================================
// ASYNC ERROR WRAPPER
// ============================================

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: {
    context?: string;
    showAlert?: boolean;
    fallback?: T;
  } = {}
): Promise<T | null> {
  const { context = "Operation", showAlert = true, fallback } = options;

  try {
    return await fn();
  } catch (error) {
    handleError(error, { context, showAlert });
    return fallback ?? null;
  }
}
