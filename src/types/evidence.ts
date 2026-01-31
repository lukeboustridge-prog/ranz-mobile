/**
 * Evidence Integrity Types
 * Types for SHA-256 hashing, chain of custody, and evidence metadata
 *
 * These types support the forensic evidence foundation for court-admissible
 * inspection reports under the NZ Evidence Act 2006.
 */

/**
 * Result of a hash operation
 *
 * The hash is generated BEFORE any file operations to ensure
 * the hash reflects the original captured data.
 */
export interface HashResult {
  /** SHA-256 hex string (64 characters) */
  hash: string;
  /** Algorithm used - always SHA-256 for consistency */
  algorithm: "SHA-256";
  /** ISO 8601 timestamp when hash was generated */
  timestamp: string;
  /** Size of data that was hashed in bytes */
  byteLength: number;
}

/**
 * Chain of custody event actions
 *
 * These actions track the complete lifecycle of evidence
 * from capture through to inclusion in court documents.
 */
export type CustodyAction =
  | "CAPTURED" // Photo/video taken on device
  | "HASHED" // SHA-256 hash generated
  | "STORED" // Saved to immutable originals directory
  | "VIEWED" // Displayed on screen
  | "SYNCED" // Uploaded to server
  | "EXPORTED" // Shared/exported from app
  | "INCLUDED_IN_REPORT" // Added to a report
  | "VERIFIED" // Hash verification performed
  | "DELETED"; // Evidence deleted from device

/**
 * A single chain of custody event
 *
 * Each event records who, what, when, and where for evidence tracking.
 * The hashAtTime field enables verification that evidence hasn't been
 * modified since a specific point in time.
 */
export interface ChainOfCustodyEvent {
  /** Unique identifier for this event */
  id: string;
  /** The action that occurred */
  action: CustodyAction;
  /** Type of evidence entity */
  entityType: "photo" | "video" | "voice_note";
  /** ID of the evidence entity */
  entityId: string;
  /** ISO 8601 timestamp when event occurred */
  timestamp: string;
  /** ID of user who performed the action */
  userId: string;
  /** Display name of user (for audit trail readability) */
  userName: string;
  /** Unique device identifier */
  deviceId: string;
  /** Hash value at time of event (for integrity verification) */
  hashAtTime: string | null;
  /** Additional context about the event */
  details: string | null;
}

/**
 * Evidence metadata attached to a file
 *
 * This metadata is captured at the moment of evidence creation
 * and links the file to its chain of custody.
 */
export interface EvidenceMetadata {
  /** SHA-256 hash of the original file */
  originalHash: string;
  /** ISO 8601 timestamp when hash was generated */
  hashGeneratedAt: string;
  /** Path in immutable originals directory (never modified) */
  originalPath: string;
  /** Path in working photos directory (may have annotations) */
  workingPath: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type (e.g., "image/jpeg", "video/mp4") */
  mimeType: string;
  /** ISO 8601 timestamp when evidence was captured */
  capturedAt: string;
  /** Unique device identifier */
  deviceId: string;
  /** ID of user who captured the evidence */
  userId: string;
}

/**
 * Storage paths configuration
 *
 * CRITICAL: The originals directory is IMMUTABLE after initial write.
 * Files must never be modified, moved, or deleted from originals/.
 */
export interface StoragePaths {
  /** Immutable originals - NEVER modified after initial copy */
  originals: string;
  /** Working copies for display and annotation */
  photos: string;
  /** Generated thumbnail images */
  thumbnails: string;
  /** Temporary files during capture */
  temp: string;
}

/**
 * Result of hash verification
 *
 * Used to confirm evidence integrity by comparing current
 * file hash against the recorded original hash.
 */
export interface VerificationResult {
  /** Whether the hashes match (evidence is unmodified) */
  isValid: boolean;
  /** The expected hash from when evidence was captured */
  expectedHash: string;
  /** The current hash of the file */
  actualHash: string;
  /** ISO 8601 timestamp when verification was performed */
  verifiedAt: string;
}

/**
 * Evidence capture context
 *
 * Provides context about the conditions when evidence was captured.
 * This supports reproducibility requirements under ISO 17020.
 */
export interface CaptureContext {
  /** ISO 8601 timestamp of capture */
  timestamp: string;
  /** GPS latitude (null if location unavailable) */
  gpsLat: number | null;
  /** GPS longitude (null if location unavailable) */
  gpsLng: number | null;
  /** GPS altitude in meters (null if unavailable) */
  gpsAltitude: number | null;
  /** GPS accuracy in meters */
  gpsAccuracy: number | null;
  /** Device manufacturer */
  deviceMake: string;
  /** Device model */
  deviceModel: string;
  /** Unique device identifier */
  deviceId: string;
  /** ID of user performing capture */
  userId: string;
  /** Display name of user */
  userName: string;
}
