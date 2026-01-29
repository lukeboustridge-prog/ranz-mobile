/**
 * Auth Constants
 *
 * Configuration and constants for mobile authentication.
 * Includes embedded JWT public key for offline token verification.
 */

import type { AuthConfig } from '../lib/auth/types';

/**
 * Authentication configuration
 * These values should match the web app configuration
 */
export const AUTH_CONFIG: AuthConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://portal.ranz.org.nz',
  jwtIssuer: 'https://portal.ranz.org.nz',
  jwtAudience: ['portal.ranz.org.nz', 'reports.ranz.org.nz'],
  accessTokenLifetime: 8 * 60 * 60, // 8 hours in seconds
};

/**
 * JWT Public Key for Offline Verification
 *
 * This RSA public key is embedded in the app bundle to enable offline JWT verification.
 * The mobile app can verify token signatures without network access.
 *
 * IMPORTANT: This must be the public key corresponding to the private key used by
 * the Quality Program API to sign tokens (JWT_PRIVATE_KEY environment variable).
 *
 * To obtain this key:
 * 1. Access the Quality Program server
 * 2. Get the value of JWT_PUBLIC_KEY environment variable
 * 3. Replace the placeholder below with the actual key
 *
 * The key format must be PEM (PKIX/SPKI) starting with "-----BEGIN PUBLIC KEY-----"
 *
 * TODO: Replace with actual public key from Quality Program environment
 */
export const JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_ACTUAL_PUBLIC_KEY_FROM_QUALITY_PROGRAM
This is a placeholder. Before deploying to production, obtain the actual
JWT_PUBLIC_KEY from the Quality Program environment variables and replace
this entire string with the real PEM-formatted RSA public key.
-----END PUBLIC KEY-----`;

/**
 * SecureStore storage keys
 * All auth-related keys are prefixed with 'ranz_' for consistency
 */
export const STORAGE_KEYS = {
  /** JWT access token */
  AUTH_TOKEN: 'ranz_auth_token',
  /** Session ID for revocation tracking */
  SESSION_ID: 'ranz_session_id',
  /** User preference for biometric unlock */
  BIOMETRICS_ENABLED: 'ranz_biometrics_enabled',
  /** Last successful online token validation timestamp */
  LAST_ONLINE_VALIDATION: 'ranz_last_online_validation',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Auth timing constants
 */
export const AUTH_TIMING = {
  /** Grace period for offline auth (30 minutes in ms) */
  OFFLINE_GRACE_PERIOD_MS: 30 * 60 * 1000,
  /** How often to re-validate online (1 hour in ms) */
  ONLINE_VALIDATION_INTERVAL_MS: 60 * 60 * 1000,
  /** Session idle timeout for biometric re-prompt (5 minutes in ms) */
  BIOMETRIC_REPROMPT_TIMEOUT_MS: 5 * 60 * 1000,
} as const;

/**
 * Auth API endpoints
 */
export const AUTH_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  VALIDATE_SESSION: '/api/auth/validate-session',
  REFRESH: '/api/auth/refresh',
} as const;
