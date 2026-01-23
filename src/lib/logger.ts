/**
 * Logger Service
 * Centralized logging with environment awareness and sensitive data protection
 *
 * In production, logs are sanitized and can be sent to external services.
 * In development, logs are output to console with full detail.
 */

// ============================================
// TYPES
// ============================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  source?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const IS_DEV = __DEV__;

// Patterns for sensitive data that should be redacted
const SENSITIVE_PATTERNS = [
  /latitude/i,
  /longitude/i,
  /gps/i,
  /lat/i,
  /lng/i,
  /coords/i,
  /location/i,
  /address/i,
  /email/i,
  /phone/i,
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
];

// Keys that should always be redacted in production
const REDACTED_KEYS = new Set([
  "latitude",
  "longitude",
  "gpsLat",
  "gpsLng",
  "gps",
  "coords",
  "email",
  "phone",
  "password",
  "token",
  "apiKey",
  "secret",
  "clientEmail",
  "clientPhone",
  "propertyAddress",
]);

// ============================================
// SANITIZATION
// ============================================

function isSensitiveKey(key: string): boolean {
  if (REDACTED_KEYS.has(key)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (IS_DEV) return value; // Show full values in dev

  if (isSensitiveKey(key)) {
    if (typeof value === "string") {
      if (value.length > 4) {
        return value.substring(0, 2) + "***" + value.substring(value.length - 2);
      }
      return "***";
    }
    if (typeof value === "number") {
      return "[REDACTED]";
    }
    return "[REDACTED]";
  }

  return value;
}

function sanitizeContext(context: LogContext): LogContext {
  if (IS_DEV) return context; // Full context in dev

  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as LogContext);
    } else {
      sanitized[key] = sanitizeValue(key, value);
    }
  }

  return sanitized;
}

// ============================================
// LOGGER CLASS
// ============================================

class Logger {
  private source: string;
  private enabled: boolean = true;
  private minLevel: LogLevel = IS_DEV ? "debug" : "info";
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  constructor(source: string) {
    this.source = source;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const prefix = `[${this.source}]`;
    const sanitizedContext = context ? sanitizeContext(context) : undefined;

    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(sanitizedContext)}`;
    }

    return `${prefix} ${message}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context: context ? sanitizeContext(context) : undefined,
      timestamp: new Date().toISOString(),
      source: this.source,
    };

    this.addToBuffer(entry);

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case "debug":
        if (IS_DEV) console.debug(formattedMessage);
        break;
      case "info":
        console.info(formattedMessage);
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        break;
    }

    // In production, could send to external logging service
    // this.sendToLoggingService(entry);
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  /**
   * Log an error with stack trace
   */
  exception(message: string, error: unknown, context?: LogContext): void {
    const errorInfo: LogContext = {
      ...context,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    this.log("error", message, errorInfo);
  }

  /**
   * Get recent logs for debugging
   */
  getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

const loggers: Map<string, Logger> = new Map();

/**
 * Create or get a logger for a specific source
 */
export function createLogger(source: string): Logger {
  if (!loggers.has(source)) {
    loggers.set(source, new Logger(source));
  }
  return loggers.get(source)!;
}

// ============================================
// PRE-CONFIGURED LOGGERS
// ============================================

export const appLogger = createLogger("App");
export const photoLogger = createLogger("PhotoService");
export const syncLogger = createLogger("SyncService");
export const authLogger = createLogger("Auth");
export const dbLogger = createLogger("Database");
export const apiLogger = createLogger("API");
export const cameraLogger = createLogger("Camera");
export const locationLogger = createLogger("Location");

// ============================================
// GLOBAL FUNCTIONS
// ============================================

/**
 * Get all recent logs from all loggers
 */
export function getAllRecentLogs(): LogEntry[] {
  const allLogs: LogEntry[] = [];
  for (const logger of loggers.values()) {
    allLogs.push(...logger.getRecentLogs());
  }
  return allLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Clear all log buffers
 */
export function clearAllLogs(): void {
  for (const logger of loggers.values()) {
    logger.clearBuffer();
  }
}

/**
 * Disable all logging (useful for tests)
 */
export function disableAllLogging(): void {
  for (const logger of loggers.values()) {
    logger.setEnabled(false);
  }
}

/**
 * Enable all logging
 */
export function enableAllLogging(): void {
  for (const logger of loggers.values()) {
    logger.setEnabled(true);
  }
}
