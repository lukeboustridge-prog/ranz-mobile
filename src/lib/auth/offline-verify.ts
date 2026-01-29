/**
 * Offline JWT Verification
 *
 * Verifies JWT tokens locally using embedded public key.
 * This enables inspectors to work offline without network access (MOBL-03).
 *
 * The jose library is used for cryptographic verification.
 */

import { jwtVerify, importSPKI } from 'jose';
import { JWT_PUBLIC_KEY, AUTH_CONFIG } from '../../constants/auth';
import type { JWTPayload } from './types';

const ALGORITHM = 'RS256';

// Cache imported public key to avoid re-parsing on every call
let cachedPublicKey: CryptoKey | null = null;

/**
 * Get the public key, importing from PEM format and caching.
 * Caching avoids repeated expensive cryptographic operations.
 */
async function getPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;
  cachedPublicKey = await importSPKI(JWT_PUBLIC_KEY, ALGORITHM);
  return cachedPublicKey;
}

/**
 * Clear the cached public key.
 * Useful for testing or if the key needs to be reloaded.
 */
export function clearKeyCache(): void {
  cachedPublicKey = null;
}

/**
 * Verify JWT token offline using embedded public key.
 * Returns payload if valid, null if invalid or expired.
 *
 * @param token - The JWT string to verify
 * @returns Verified payload or null if invalid
 */
export async function verifyTokenOffline(token: string): Promise<JWTPayload | null> {
  try {
    const publicKey = await getPublicKey();

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: AUTH_CONFIG.jwtIssuer,
      audience: AUTH_CONFIG.jwtAudience,
    });

    return payload as unknown as JWTPayload;
  } catch (error) {
    // Token invalid, expired, or signature mismatch
    console.warn('[OfflineVerify] Token verification failed:', error);
    return null;
  }
}

/**
 * Check if token is expired without full verification.
 * Fast check using only base64 decode - no cryptographic operations.
 *
 * @param token - The JWT string to check
 * @returns true if expired or malformed, false if still valid
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Use base64 decode - atob is available in React Native
    // Handle URL-safe base64 by replacing characters
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));

    if (!payload.exp) return true;

    // exp is Unix timestamp in seconds
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Calculate remaining token lifetime in seconds.
 * Returns 0 if expired or invalid.
 *
 * @param token - The JWT string
 * @returns Remaining seconds, or 0 if expired/invalid
 */
export function getTokenRemainingSeconds(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));

    if (!payload.exp) return 0;

    const remaining = payload.exp * 1000 - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  } catch {
    return 0;
  }
}

/**
 * Decode JWT payload without verification.
 * Useful for extracting claims for display purposes only.
 * DO NOT use for authorization decisions.
 *
 * @param token - The JWT string to decode
 * @returns Decoded payload or null if malformed
 */
export function decodeTokenUnsafe(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Handle URL-safe base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));

    return payload as JWTPayload;
  } catch {
    return null;
  }
}
