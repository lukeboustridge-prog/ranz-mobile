/**
 * Environment Configuration
 * Centralized environment-specific settings for development, preview, and production.
 *
 * Reads EXPO_PUBLIC_APP_ENV to determine current environment.
 */

// React Native __DEV__ global (provided by Metro bundler)
declare const __DEV__: boolean;

// Environment types
export type Environment = "development" | "preview" | "production";

// Environment configuration interface
export interface EnvironmentConfig {
  /** Current environment */
  environment: Environment;
  /** API base URL */
  apiUrl: string;
  /** Sentry DSN (null if disabled) */
  sentryDsn: string | null;
  /** Enable console logging */
  enableLogs: boolean;
  /** Enable developer tools (React DevTools, etc.) */
  enableDevTools: boolean;
}

// Environment-specific configurations
const environmentConfigs: Record<Environment, Omit<EnvironmentConfig, "environment">> = {
  development: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    sentryDsn: null, // No Sentry in development
    enableLogs: true,
    enableDevTools: true,
  },
  preview: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://preview.reports.ranz.org.nz",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || null,
    enableLogs: true, // Useful for debugging preview builds
    enableDevTools: false,
  },
  production: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://reports.ranz.org.nz",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || null,
    enableLogs: false,
    enableDevTools: false,
  },
};

/**
 * Get the current environment from EXPO_PUBLIC_APP_ENV
 * Defaults to 'development' if not set or invalid
 */
export function getCurrentEnvironment(): Environment {
  const envValue = process.env.EXPO_PUBLIC_APP_ENV;

  if (envValue === "production" || envValue === "preview" || envValue === "development") {
    return envValue;
  }

  // Default to development if not set or invalid
  if (__DEV__) {
    return "development";
  }

  // In non-dev builds without explicit env, assume production
  return "production";
}

/**
 * Get the configuration for the current environment
 */
export function getConfig(): EnvironmentConfig {
  const environment = getCurrentEnvironment();
  return {
    environment,
    ...environmentConfigs[environment],
  };
}

// Export the config object for direct access
export const config = getConfig();

// Helper functions for common checks
export function isDevelopment(): boolean {
  return config.environment === "development";
}

export function isPreview(): boolean {
  return config.environment === "preview";
}

export function isProduction(): boolean {
  return config.environment === "production";
}

/**
 * Log a message only if logging is enabled for the current environment
 */
export function envLog(message: string, ...args: unknown[]): void {
  if (config.enableLogs) {
    console.log(`[${config.environment.toUpperCase()}] ${message}`, ...args);
  }
}

/**
 * Log a warning only if logging is enabled for the current environment
 */
export function envWarn(message: string, ...args: unknown[]): void {
  if (config.enableLogs) {
    console.warn(`[${config.environment.toUpperCase()}] ${message}`, ...args);
  }
}

/**
 * Log an error (always enabled - errors should always be logged)
 */
export function envError(message: string, ...args: unknown[]): void {
  console.error(`[${config.environment.toUpperCase()}] ${message}`, ...args);
}
