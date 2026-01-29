/**
 * Deep Linking for SSO Callbacks
 *
 * Handles deep link URLs for authentication callbacks from SSO flows.
 * When user authenticates via web-based SSO, the token is passed back
 * to the mobile app via a deep link URL.
 *
 * Supported deep link routes:
 * - ranz://auth/callback?token=xxx  - SSO callback with JWT token
 * - ranz://report/{id}              - Open specific report (future)
 * - ranz://settings                 - Open settings (future)
 *
 * IMPORTANT: Deep links with custom scheme (ranz://) only work with
 * EAS development builds, NOT Expo Go. Expo Go uses exp:// scheme.
 * Testing deep links requires running: eas build --profile development
 *
 * URL Scheme Configuration:
 * - Configured in app.json: { "expo": { "scheme": "ranz" } }
 * - iOS: Custom URL scheme registered automatically
 * - Android: Intent filter added automatically
 */

import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { useAuthStore } from '../../stores/auth-store';

// ============================================
// CONSTANTS
// ============================================

/**
 * Path for authentication callback deep links
 * Full URL: ranz://auth/callback?token=xxx
 */
const AUTH_CALLBACK_PATH = 'auth/callback';

// ============================================
// TYPES
// ============================================

/**
 * Parsed deep link data
 */
export interface ParsedDeepLink {
  /** Path portion of the URL (e.g., "auth/callback") */
  path: string | null;
  /** Query parameters as key-value pairs */
  params: Record<string, string>;
}

/**
 * Deep link handler result
 */
export interface DeepLinkResult {
  /** Whether the deep link was handled */
  handled: boolean;
  /** Type of deep link that was processed */
  type?: 'auth_callback' | 'report' | 'settings' | 'unknown';
  /** Any error that occurred */
  error?: string;
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook for handling authentication deep links
 *
 * Listens for incoming deep links and processes auth callbacks.
 * Should be called in the root layout to catch all incoming links.
 *
 * When a ranz://auth/callback?token=xxx URL is received:
 * 1. Extracts the token from query params
 * 2. Calls loginWithToken to verify and store the token
 * 3. On success, user is authenticated
 * 4. On failure, logs error (future: navigate to error screen)
 *
 * @example
 * // In app/_layout.tsx
 * export default function RootLayout() {
 *   useAuthDeepLink(); // Add this to handle SSO callbacks
 *
 *   return (
 *     <Stack>
 *       ...
 *     </Stack>
 *   );
 * }
 */
export function useAuthDeepLink(): void {
  // Get loginWithToken from auth store
  // loginWithToken handles token verification and storage
  const loginWithToken = useAuthStore((state) => state.loginWithToken);

  // Get current URL from Linking
  // This updates whenever app receives a deep link
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;

    // Parse the incoming URL
    const parsed = Linking.parse(url);

    // Handle auth callback: ranz://auth/callback?token=xxx
    if (parsed.path === AUTH_CALLBACK_PATH && parsed.queryParams?.token) {
      handleAuthCallback(parsed.queryParams.token as string);
    }
  }, [url]); // Re-run when URL changes

  /**
   * Handle auth callback deep link
   *
   * @param token - JWT token from callback URL
   */
  async function handleAuthCallback(token: string): Promise<void> {
    try {
      // Use loginWithToken which verifies and stores the token
      // This is the method for SSO callbacks (token already obtained)
      const success = await loginWithToken(token);

      if (!success) {
        console.error('[DeepLink] Auth callback failed - invalid token');
        // TODO: Navigate to error screen or show toast
        // Could use router.replace('/auth/error') when wired up
      }

      // On success, auth store is updated and app will react to auth state change
      // Navigation to protected routes happens via auth guards in layout
    } catch (error) {
      console.error('[DeepLink] Auth callback error:', error);
      // TODO: Navigate to error screen
    }
  }
}

// ============================================
// URL GENERATION
// ============================================

/**
 * Get the callback URL for authentication flows
 *
 * Returns the deep link URL that should be passed to web-based auth flows.
 * The SSO provider will redirect to this URL with the token.
 *
 * @returns Deep link URL for auth callbacks (e.g., "ranz://auth/callback")
 *
 * @example
 * // When initiating SSO login
 * const callbackUrl = getAuthCallbackUrl();
 * // Pass to web auth: https://portal.ranz.org.nz/auth/mobile-login?redirect_uri=ranz://auth/callback
 */
export function getAuthCallbackUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/**
 * Get a deep link URL for a specific report
 *
 * @param reportId - Report ID to link to
 * @returns Deep link URL (e.g., "ranz://report/abc123")
 *
 * @example
 * const url = getReportDeepLink('abc123');
 * // Share this URL to open report directly in app
 */
export function getReportDeepLink(reportId: string): string {
  return Linking.createURL(`report/${reportId}`);
}

// ============================================
// URL PARSING
// ============================================

/**
 * Parse a deep link URL into path and params
 *
 * @param url - Deep link URL to parse
 * @returns Parsed deep link with path and params
 *
 * @example
 * const parsed = parseDeepLink('ranz://auth/callback?token=xxx&state=abc');
 * // { path: 'auth/callback', params: { token: 'xxx', state: 'abc' } }
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  const parsed = Linking.parse(url);

  // Convert queryParams to simple Record<string, string>
  const params: Record<string, string> = {};
  if (parsed.queryParams) {
    for (const [key, value] of Object.entries(parsed.queryParams)) {
      // Only include string values, skip arrays or undefined
      if (typeof value === 'string') {
        params[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        // Take first value for arrays
        params[key] = value[0];
      }
    }
  }

  return {
    path: parsed.path,
    params,
  };
}

/**
 * Check if a URL is an auth callback deep link
 *
 * @param url - URL to check
 * @returns true if this is an auth callback URL
 *
 * @example
 * if (isAuthCallbackUrl(url)) {
 *   // Handle auth callback
 * }
 */
export function isAuthCallbackUrl(url: string): boolean {
  const parsed = Linking.parse(url);
  return parsed.path === AUTH_CALLBACK_PATH && !!parsed.queryParams?.token;
}

// ============================================
// APP LINKING CONFIGURATION
// ============================================

/**
 * Get linking configuration for Expo Router
 *
 * Returns the linking configuration needed for Expo Router to handle
 * deep links properly. Include this in your root layout.
 *
 * @returns Linking configuration object
 *
 * @example
 * // In app/_layout.tsx with Expo Router
 * const linking = getDeepLinkConfig();
 */
export function getDeepLinkConfig() {
  return {
    prefixes: [
      Linking.createURL('/'), // ranz://
      'https://reports.ranz.org.nz', // Universal links (future)
    ],
  };
}
