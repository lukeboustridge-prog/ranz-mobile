/**
 * Mobile Auth Types
 *
 * Type definitions for the mobile authentication system.
 * These types mirror the web app's auth types (RANZ Quality Program/src/lib/auth/types.ts)
 * for consistency across the ecosystem.
 */

// JWT Payload structure - matches web app for cross-platform consistency
export interface JWTPayload {
  // Standard JWT claims
  sub: string;          // User ID (AuthUser.id)
  iat?: number;         // Issued at (Unix timestamp)
  exp?: number;         // Expiration (Unix timestamp)
  jti?: string;         // JWT ID (unique token identifier)
  iss?: string;         // Issuer (https://portal.ranz.org.nz)
  aud?: string[];       // Audience (allowed domains)

  // Custom claims
  email: string;
  name: string;         // firstName + lastName
  role: AuthUserRole;   // User type for RBAC
  companyId?: string;   // For member users
  sessionId: string;    // Links to AuthSession table for revocation
  type: 'access' | 'refresh';
}

// User roles from Prisma enum (duplicated for runtime use without Prisma import)
export type AuthUserRole =
  | 'MEMBER_COMPANY_ADMIN'
  | 'MEMBER_COMPANY_USER'
  | 'RANZ_ADMIN'
  | 'RANZ_STAFF'
  | 'RANZ_INSPECTOR'
  | 'EXTERNAL_INSPECTOR';

// User status
export type AuthUserStatusType =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED';

// Application types
export type AuthAppType = 'QUALITY_PROGRAM' | 'ROOFING_REPORT' | 'MOBILE';

// Biometric security levels
export enum BiometricLevel {
  NONE = 'NONE',
  WEAK = 'WEAK',     // 2D face unlock (Android)
  STRONG = 'STRONG', // Fingerprint, 3D face (iOS Face ID, Android fingerprint)
}

// Biometric capability info
export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  level: BiometricLevel;
  types: number[]; // LocalAuthentication.AuthenticationType values
}

// Auth state for Zustand store
export interface AuthState {
  // User state
  user: JWTPayload | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Connectivity state
  isOffline: boolean;

  // Biometrics
  biometricsEnabled: boolean;

  // Validation tracking
  lastOnlineValidation: number | null;
}

// Login response from API
export interface LoginResponse {
  token?: string;
  error?: string;
  mustChangePassword?: boolean;
}

// Auth configuration interface
export interface AuthConfig {
  apiBaseUrl: string;
  jwtIssuer: string;
  jwtAudience: string[];
  accessTokenLifetime: number; // in seconds
}

// Biometric auth result
export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  fallbackToPassword?: boolean;
}

// Session validation result
export interface SessionValidationResult {
  valid: boolean;
  reason?: 'expired' | 'revoked' | 'invalid' | 'network_error';
}

// Simplified user type for UI display
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: AuthUserRole;
  companyId?: string;
  status: AuthUserStatusType;
  mustChangePassword: boolean;
}
