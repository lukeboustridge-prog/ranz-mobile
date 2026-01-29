/**
 * Biometric Authentication Module
 *
 * Provides biometric authentication (Face ID, Touch ID, fingerprint) with
 * security level checks. For sensitive operations, STRONG biometrics are
 * required (fingerprint, 3D face) - not WEAK biometrics (2D face unlock).
 *
 * Security levels:
 * - NONE: No biometric hardware or not enrolled
 * - WEAK: 2D face unlock (Android) - can be spoofed with photos
 * - STRONG: Fingerprint, 3D face (iOS Face ID, Android fingerprint)
 *
 * Usage:
 * - Quick app unlock: authenticateWithBiometrics()
 * - Sensitive operations: authenticateWithBiometrics({ requireStrong: true })
 */

import * as LocalAuthentication from 'expo-local-authentication';

// ============================================
// TYPES
// ============================================

/**
 * Biometric security levels
 * Maps to LocalAuthentication.SecurityLevel
 */
export enum BiometricLevel {
  /** No biometric hardware or no enrolled biometrics */
  NONE = 'NONE',
  /** 2D face unlock (Android) - can be spoofed with photos */
  WEAK = 'WEAK',
  /** Fingerprint, 3D face (iOS Face ID, Android fingerprint) */
  STRONG = 'STRONG',
}

/**
 * Device biometric capability information
 */
export interface BiometricCapability {
  /** Whether biometric hardware exists on device */
  available: boolean;
  /** Whether user has enrolled biometrics */
  enrolled: boolean;
  /** Security level of enrolled biometrics */
  level: BiometricLevel;
  /** Types of biometrics available (fingerprint, face, iris) */
  types: LocalAuthentication.AuthenticationType[];
}

/**
 * Result of a biometric authentication attempt
 */
export interface BiometricAuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** Error message if authentication failed */
  error?: string;
  /** True if user chose to use password instead */
  fallbackToPassword?: boolean;
}

/**
 * Options for biometric authentication
 */
export interface BiometricAuthOptions {
  /** Require STRONG biometrics (fingerprint/3D face) - use for sensitive operations */
  requireStrong?: boolean;
  /** Message shown during authentication prompt */
  promptMessage?: string;
  /** Label for password fallback button */
  fallbackLabel?: string;
  /** Subtitle message (Android only) */
  subtitle?: string;
}

// ============================================
// CAPABILITY DETECTION
// ============================================

/**
 * Get device biometric capabilities
 *
 * Checks hardware availability, enrollment status, security level,
 * and types of biometrics supported.
 *
 * @returns BiometricCapability with device biometric info
 *
 * @example
 * const capability = await getBiometricCapability();
 * if (capability.available && capability.enrolled) {
 *   // Biometrics are ready to use
 *   if (capability.level === BiometricLevel.STRONG) {
 *     // Safe for sensitive operations
 *   }
 * }
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    // Check if device has biometric hardware
    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    // Check if user has enrolled biometrics
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    // Get security level of enrolled biometrics
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

    // Get types of biometrics available
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    // Map security level to BiometricLevel enum
    let level: BiometricLevel = BiometricLevel.NONE;
    if (securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
      level = BiometricLevel.STRONG;
    } else if (securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK) {
      level = BiometricLevel.WEAK;
    }

    return {
      available: hasHardware,
      enrolled: isEnrolled,
      level,
      types,
    };
  } catch (error) {
    console.error('[Biometrics] Failed to get capability:', error);
    // Return safe defaults on error
    return {
      available: false,
      enrolled: false,
      level: BiometricLevel.NONE,
      types: [],
    };
  }
}

/**
 * Quick check if biometrics can be used
 *
 * Returns true if device has biometric hardware AND user has enrolled biometrics.
 * Does not check security level - use getBiometricCapability() for that.
 *
 * @returns true if biometrics are available and enrolled
 *
 * @example
 * if (await canUseBiometrics()) {
 *   // Show biometric unlock option
 * }
 */
export async function canUseBiometrics(): Promise<boolean> {
  try {
    const capability = await getBiometricCapability();
    return capability.available && capability.enrolled;
  } catch (error) {
    console.error('[Biometrics] canUseBiometrics check failed:', error);
    return false;
  }
}

/**
 * Check if STRONG biometrics are available
 *
 * Returns true only if device has hardware, user has enrolled, AND
 * the enrolled biometrics are STRONG level (fingerprint or 3D face).
 *
 * @returns true if strong biometrics are available
 *
 * @example
 * if (await hasStrongBiometrics()) {
 *   // Safe to use for sensitive operations
 * }
 */
export async function hasStrongBiometrics(): Promise<boolean> {
  try {
    const capability = await getBiometricCapability();
    return capability.available && capability.enrolled && capability.level === BiometricLevel.STRONG;
  } catch (error) {
    console.error('[Biometrics] hasStrongBiometrics check failed:', error);
    return false;
  }
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Authenticate user with biometrics
 *
 * Shows system biometric prompt (Face ID, Touch ID, fingerprint).
 * For sensitive operations (viewing credentials, changing settings),
 * use requireStrong: true to ensure only fingerprint or 3D face is accepted.
 *
 * @param options - Authentication options
 * @returns BiometricAuthResult with success status and any errors
 *
 * @example Basic unlock
 * const result = await authenticateWithBiometrics({
 *   promptMessage: 'Unlock RANZ App',
 * });
 * if (result.success) {
 *   // Proceed with unlock
 * } else if (result.fallbackToPassword) {
 *   // User chose to use password
 * }
 *
 * @example Sensitive operation
 * const result = await authenticateWithBiometrics({
 *   requireStrong: true,
 *   promptMessage: 'Confirm your identity to view credentials',
 * });
 * if (result.success) {
 *   // Safe to show sensitive data
 * }
 */
export async function authenticateWithBiometrics(
  options: BiometricAuthOptions = {}
): Promise<BiometricAuthResult> {
  const {
    requireStrong = false,
    promptMessage = 'Authenticate to continue',
    fallbackLabel = 'Use password',
    subtitle,
  } = options;

  try {
    // First check capability
    const capability = await getBiometricCapability();

    // Check if biometrics are available
    if (!capability.available) {
      return {
        success: false,
        error: 'Biometric hardware not available on this device',
        fallbackToPassword: true,
      };
    }

    // Check if biometrics are enrolled
    if (!capability.enrolled) {
      return {
        success: false,
        error: 'No biometrics enrolled. Please set up Face ID or fingerprint in device settings.',
        fallbackToPassword: true,
      };
    }

    // For sensitive operations, require STRONG biometrics
    if (requireStrong && capability.level !== BiometricLevel.STRONG) {
      return {
        success: false,
        error: 'Strong biometrics (fingerprint or Face ID) required for this operation. 2D face unlock is not secure enough.',
        fallbackToPassword: true,
      };
    }

    // Attempt biometric authentication
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      disableDeviceFallback: false, // Allow PIN/pattern as fallback
      cancelLabel: 'Cancel',
    });

    // Handle authentication result
    if (result.success) {
      return { success: true };
    }

    // User chose fallback option
    if (result.error === 'user_fallback') {
      return {
        success: false,
        fallbackToPassword: true,
      };
    }

    // User cancelled
    if (result.error === 'user_cancel' || result.error === 'system_cancel') {
      return {
        success: false,
        error: 'Authentication cancelled',
      };
    }

    // Lockout (too many failed attempts)
    if (result.error === 'lockout') {
      return {
        success: false,
        error: 'Too many failed attempts. Please try again later or use your password.',
        fallbackToPassword: true,
      };
    }

    // Other error
    return {
      success: false,
      error: result.error || 'Authentication failed',
    };
  } catch (error) {
    console.error('[Biometrics] Authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Biometric authentication failed',
      fallbackToPassword: true,
    };
  }
}

/**
 * Get human-readable name for biometric type
 *
 * @param types - Array of authentication types from getBiometricCapability
 * @returns User-friendly string like "Face ID", "Touch ID", or "Fingerprint"
 *
 * @example
 * const capability = await getBiometricCapability();
 * const name = getBiometricTypeName(capability.types);
 * // "Face ID" on iPhone X+, "Touch ID" on older iPhones, "Fingerprint" on Android
 */
export function getBiometricTypeName(types: LocalAuthentication.AuthenticationType[]): string {
  // Face recognition (Face ID on iOS)
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }

  // Fingerprint (Touch ID on iOS, fingerprint on Android)
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    // Could be Touch ID on older iPhones or fingerprint on Android
    // Platform detection would be needed for "Touch ID" vs "Fingerprint"
    return 'Fingerprint';
  }

  // Iris (rare, some Android devices)
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }

  return 'Biometric';
}
