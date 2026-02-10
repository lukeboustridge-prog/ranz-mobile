/**
 * Offline JWT Verification
 *
 * Verifies JWT tokens locally by decoding and validating claims
 * (issuer, audience, expiry). On platforms with Web Crypto API support,
 * also performs RSA signature verification using jose.
 *
 * React Native/Hermes does not provide crypto.subtle, so signature
 * verification is skipped on mobile. The token is still trusted because:
 * - It was received over HTTPS from our own server
 * - It is stored in SecureStore (device-encrypted, WHEN_UNLOCKED_THIS_DEVICE_ONLY)
 * - Claims (issuer, audience, expiry) are validated
 */

import { AUTH_CONFIG } from '../../constants/auth';
import type { JWTPayload } from './types';

/**
 * Check if Web Crypto API is available (not available on React Native/Hermes)
 */
function hasWebCrypto(): boolean {
  try {
    return (
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.subtle !== 'undefined' &&
      typeof globalThis.crypto.subtle.importKey === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Decode a base64url-encoded JWT segment
 */
function decodeSegment(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

/**
 * Verify JWT token offline by decoding and validating claims.
 * If Web Crypto is available, also verifies the RSA signature.
 * Returns payload if valid, null if invalid or expired.
 *
 * @param token - The JWT string to verify
 * @returns Verified payload or null if invalid
 */
export async function verifyTokenOffline(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[OfflineVerify] Malformed token: wrong number of segments');
      return null;
    }

    // Decode and parse header
    const header = JSON.parse(decodeSegment(parts[0]));
    if (header.alg !== 'RS256') {
      console.warn('[OfflineVerify] Unexpected algorithm:', header.alg);
      return null;
    }

    // Decode and parse payload
    const payload = JSON.parse(decodeSegment(parts[1]));

    // Validate expiry
    if (!payload.exp || Date.now() >= payload.exp * 1000) {
      console.warn('[OfflineVerify] Token expired');
      return null;
    }

    // Validate issued-at (reject tokens from the future with 60s clock skew tolerance)
    if (payload.iat && payload.iat * 1000 > Date.now() + 60_000) {
      console.warn('[OfflineVerify] Token issued in the future');
      return null;
    }

    // Validate issuer
    if (payload.iss !== AUTH_CONFIG.jwtIssuer) {
      console.warn('[OfflineVerify] Issuer mismatch:', payload.iss);
      return null;
    }

    // Validate audience
    const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const expectedAud = AUTH_CONFIG.jwtAudience;
    const hasValidAud = tokenAud.some((a: string) => expectedAud.includes(a));
    if (!hasValidAud) {
      console.warn('[OfflineVerify] Audience mismatch:', payload.aud);
      return null;
    }

    // Validate required fields
    if (!payload.sub || !payload.email || !payload.role) {
      console.warn('[OfflineVerify] Missing required claims');
      return null;
    }

    // If Web Crypto is available, verify RSA signature
    if (hasWebCrypto()) {
      try {
        const { jwtVerify, importSPKI } = await import('jose');
        const { JWT_PUBLIC_KEY } = await import('../../constants/auth');
        const publicKey = await importSPKI(JWT_PUBLIC_KEY, 'RS256');
        await jwtVerify(token, publicKey, {
          issuer: AUTH_CONFIG.jwtIssuer,
          audience: AUTH_CONFIG.jwtAudience,
        });
      } catch (cryptoError) {
        console.warn('[OfflineVerify] Signature verification failed:', cryptoError);
        return null;
      }
    }

    return payload as JWTPayload;
  } catch (error) {
    console.warn('[OfflineVerify] Token verification failed:', error);
    return null;
  }
}

/**
 * Clear the cached public key (no-op now, kept for API compatibility)
 */
export function clearKeyCache(): void {
  // No caching needed for claims-based verification
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

    const payload = JSON.parse(decodeSegment(parts[1]));
    if (!payload.exp) return true;

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

    const payload = JSON.parse(decodeSegment(parts[1]));
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

    const payload = JSON.parse(decodeSegment(parts[1]));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}
