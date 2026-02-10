/**
 * Auth API Client
 *
 * Handles authentication-specific API calls to the Quality Program backend.
 * Used by the auth store for login, logout, and session validation.
 */

import { AUTH_CONFIG, AUTH_ENDPOINTS } from '../../constants/auth';
import { getToken } from './storage';

// ============================================
// TYPES
// ============================================

/**
 * Response from the login API
 */
export interface LoginResponse {
  success: boolean;
  token?: string;
  mustChangePassword?: boolean;
  error?: string;
}

/**
 * Response from the session validation API
 */
export interface SessionValidationResponse {
  valid: boolean;
  error?: string;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Login with email and password credentials.
 * Returns a JWT token on success.
 *
 * The X-Application header identifies this as a mobile client,
 * which tells the server to return the token in the response body
 * (instead of setting a cookie like for web clients).
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Login response with token or error
 */
export async function loginWithCredentials(
  email: string,
  password: string
): Promise<LoginResponse> {
  try {
    const response = await fetch(`${AUTH_CONFIG.apiBaseUrl}${AUTH_ENDPOINTS.LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Application': 'MOBILE',
      },
      body: JSON.stringify({ email, password }),
    });

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        error: `Server error (${response.status}). Please try again.`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: (data.message as string) || (data.error as string) || 'Login failed',
      };
    }

    // The web app returns accessToken in response body for mobile clients
    return {
      success: true,
      token: data.accessToken,
      mustChangePassword: data.mustChangePassword,
    };
  } catch (error) {
    console.error('[AuthAPI] Login request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Logout from the server.
 * Revokes the current session server-side.
 *
 * This is fire-and-forget - we always succeed locally even if the
 * server call fails. This ensures users can always log out.
 */
export async function logoutFromServer(): Promise<void> {
  try {
    const token = await getToken();
    if (!token) {
      // No token, nothing to logout
      return;
    }

    await fetch(`${AUTH_CONFIG.apiBaseUrl}${AUTH_ENDPOINTS.LOGOUT}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Application': 'MOBILE',
      },
    });
    // Don't check response - logout always "succeeds" locally
  } catch (error) {
    // Log but don't throw - logout should always succeed locally
    console.warn('[AuthAPI] Logout server call failed:', error);
  }
}

/**
 * Validate current session with the server.
 * Used to check if the stored token is still valid on the server
 * (e.g., hasn't been revoked).
 *
 * @param token - The JWT token to validate
 * @returns true if session is valid, false otherwise
 */
export async function validateSessionOnline(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${AUTH_CONFIG.apiBaseUrl}${AUTH_ENDPOINTS.VALIDATE_SESSION}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Application': 'MOBILE',
        },
      }
    );

    return response.ok;
  } catch (error) {
    // Network error - can't validate
    console.warn('[AuthAPI] Session validation failed:', error);
    return false;
  }
}

/**
 * Refresh the current access token.
 * Used when the token is close to expiry but still valid.
 *
 * Note: This endpoint may not be implemented yet on the server.
 * Currently, tokens are 8 hours and must be re-obtained via login.
 *
 * @param token - Current token to refresh
 * @returns New token or null if refresh failed
 */
export async function refreshToken(token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${AUTH_CONFIG.apiBaseUrl}${AUTH_ENDPOINTS.REFRESH}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Application': 'MOBILE',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.accessToken || null;
  } catch (error) {
    console.warn('[AuthAPI] Token refresh failed:', error);
    return null;
  }
}
