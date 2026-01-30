/**
 * Chain of Custody Service
 * Records every evidence access for legal admissibility
 *
 * Every photo/video access must be logged:
 * - CAPTURED: When evidence is created
 * - HASHED: When hash is generated
 * - STORED: When saved to originals
 * - VIEWED: When displayed on screen
 * - SYNCED: When uploaded to server
 * - EXPORTED: When shared/exported
 * - INCLUDED_IN_REPORT: When added to a report
 * - VERIFIED: When hash is checked
 *
 * CRITICAL: The audit log is APPEND-ONLY. Events cannot be modified or deleted
 * by application code. This ensures a tamper-evident audit trail for legal proceedings.
 *
 * @module chain-of-custody
 */

import { addAuditLog, getAuditLogForEntity } from "../lib/sqlite";
import { getOrCreateDeviceId } from "../lib/storage";
import type { CustodyAction, ChainOfCustodyEvent } from "../types/evidence";

/**
 * Log a chain of custody event
 *
 * This is an APPEND-ONLY operation. Events cannot be modified or deleted.
 * The event is stored in the SQLite audit_log table with deviceId and hashAtTime
 * encoded in the details JSON.
 *
 * @param action - The custody action being logged
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User performing the action
 * @param userName - User's display name
 * @param hashAtTime - Current hash of the evidence (for verification)
 * @param details - Optional additional context
 */
export async function logCustodyEvent(
  action: CustodyAction,
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  hashAtTime: string | null = null,
  details: string | null = null
): Promise<void> {
  const deviceId = await getOrCreateDeviceId();

  // Build details JSON including hash and device info
  const detailsObj: Record<string, unknown> = {
    deviceId,
    hashAtTime,
  };

  if (details) {
    detailsObj.notes = details;
  }

  // Add to audit log (append-only operation)
  await addAuditLog(
    action,
    entityType,
    entityId,
    userId,
    userName,
    JSON.stringify(detailsObj)
  );
}

/**
 * Get the complete chain of custody for an evidence item
 *
 * Returns all custody events for the specified evidence, ordered chronologically.
 * Each event includes deviceId and hashAtTime extracted from the details JSON.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @returns Array of custody events in chronological order (newest first, matching SQLite ORDER BY)
 */
export async function getCustodyChain(
  entityType: "photo" | "video" | "voice_note",
  entityId: string
): Promise<ChainOfCustodyEvent[]> {
  const auditLogs = await getAuditLogForEntity(entityType, entityId);

  return auditLogs.map((log) => {
    // Parse details JSON to extract deviceId and hashAtTime
    let deviceId = "unknown";
    let hashAtTime: string | null = null;
    let notes: string | null = null;

    if (log.details) {
      try {
        const parsed = JSON.parse(log.details);
        deviceId = parsed.deviceId || "unknown";
        hashAtTime = parsed.hashAtTime || null;
        notes = parsed.notes || null;
      } catch {
        // If details isn't JSON, use as-is
        notes = log.details;
      }
    }

    return {
      id: log.id,
      action: log.action as CustodyAction,
      entityType: log.entityType as "photo" | "video" | "voice_note",
      entityId: log.entityId,
      timestamp: log.createdAt,
      userId: log.userId,
      userName: log.userName,
      deviceId,
      hashAtTime,
      details: notes,
    };
  });
}

/**
 * Log capture event - call immediately after photo/video capture
 *
 * This should be the FIRST custody event logged for any evidence item.
 * The originalHash should be computed BEFORE any file operations.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User performing the capture
 * @param userName - User's display name
 * @param originalHash - SHA-256 hash computed from the original captured data
 * @param captureDetails - Optional context (e.g., "Captured at property inspection")
 */
export async function logCapture(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  originalHash: string,
  captureDetails?: string
): Promise<void> {
  await logCustodyEvent(
    "CAPTURED",
    entityType,
    entityId,
    userId,
    userName,
    originalHash,
    captureDetails || null
  );
}

/**
 * Log storage event - call after saving to originals directory
 *
 * This records that evidence has been saved to the immutable originals directory.
 * The storagePath is recorded in the details for audit purposes.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User performing the storage
 * @param userName - User's display name
 * @param originalHash - SHA-256 hash of the stored evidence
 * @param storagePath - Path where the evidence was stored
 */
export async function logStorage(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  originalHash: string,
  storagePath: string
): Promise<void> {
  await logCustodyEvent(
    "STORED",
    entityType,
    entityId,
    userId,
    userName,
    originalHash,
    `Stored at: ${storagePath}`
  );
}

/**
 * Log view event - call when evidence is displayed
 *
 * This records each time evidence is viewed, which may be relevant
 * for understanding the chain of custody in legal proceedings.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User viewing the evidence
 * @param userName - User's display name
 * @param currentHash - Current SHA-256 hash for integrity verification
 */
export async function logView(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  currentHash: string
): Promise<void> {
  await logCustodyEvent(
    "VIEWED",
    entityType,
    entityId,
    userId,
    userName,
    currentHash,
    null
  );
}

/**
 * Log sync event - call after uploading to server
 *
 * This records that evidence has been synchronized with the server.
 * The serverUrl is recorded for traceability.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User performing the sync
 * @param userName - User's display name
 * @param currentHash - Current SHA-256 hash for integrity verification
 * @param serverUrl - URL where the evidence was synced
 */
export async function logSync(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  currentHash: string,
  serverUrl: string
): Promise<void> {
  await logCustodyEvent(
    "SYNCED",
    entityType,
    entityId,
    userId,
    userName,
    currentHash,
    `Synced to: ${serverUrl}`
  );
}

/**
 * Log inclusion in report - call when evidence is added to a report
 *
 * This is critical for legal proceedings as it documents exactly
 * which evidence was included in which report, and by whom.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User adding the evidence to the report
 * @param userName - User's display name
 * @param currentHash - Current SHA-256 hash for integrity verification
 * @param reportId - ID of the report the evidence was added to
 */
export async function logIncludeInReport(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  currentHash: string,
  reportId: string
): Promise<void> {
  await logCustodyEvent(
    "INCLUDED_IN_REPORT",
    entityType,
    entityId,
    userId,
    userName,
    currentHash,
    `Report: ${reportId}`
  );
}

/**
 * Log verification event - call when hash is verified
 *
 * This records hash verification attempts, including both successful
 * and failed verifications. This is important for detecting tampering.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User performing the verification
 * @param userName - User's display name
 * @param verificationResult - Whether the verification passed
 * @param expectedHash - The expected hash from when evidence was captured
 * @param actualHash - The current hash of the file
 */
export async function logVerification(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  verificationResult: boolean,
  expectedHash: string,
  actualHash: string
): Promise<void> {
  await logCustodyEvent(
    "VERIFIED",
    entityType,
    entityId,
    userId,
    userName,
    actualHash,
    `Verification ${verificationResult ? "PASSED" : "FAILED"}: expected ${expectedHash.substring(0, 8)}...`
  );
}

/**
 * Log export event - call when evidence is exported or shared
 *
 * This records when evidence is exported from the application,
 * which may be relevant for understanding how evidence was distributed.
 *
 * @param entityType - Type of evidence (photo, video, voice_note)
 * @param entityId - Unique ID of the evidence
 * @param userId - User performing the export
 * @param userName - User's display name
 * @param currentHash - Current SHA-256 hash for integrity verification
 * @param exportDestination - Description of where the evidence was exported
 */
export async function logExport(
  entityType: "photo" | "video" | "voice_note",
  entityId: string,
  userId: string,
  userName: string,
  currentHash: string,
  exportDestination: string
): Promise<void> {
  await logCustodyEvent(
    "EXPORTED",
    entityType,
    entityId,
    userId,
    userName,
    currentHash,
    `Exported to: ${exportDestination}`
  );
}

/**
 * Chain of Custody Service singleton
 *
 * Provides a class-based interface for chain of custody operations.
 * Use the singleton export `chainOfCustodyService` for convenience.
 */
export class ChainOfCustodyService {
  private static instance: ChainOfCustodyService;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ChainOfCustodyService {
    if (!ChainOfCustodyService.instance) {
      ChainOfCustodyService.instance = new ChainOfCustodyService();
    }
    return ChainOfCustodyService.instance;
  }

  /** Log capture event */
  logCapture = logCapture;

  /** Log storage event */
  logStorage = logStorage;

  /** Log view event */
  logView = logView;

  /** Log sync event */
  logSync = logSync;

  /** Log inclusion in report */
  logIncludeInReport = logIncludeInReport;

  /** Log verification event */
  logVerification = logVerification;

  /** Log export event */
  logExport = logExport;

  /** Get complete chain of custody */
  getCustodyChain = getCustodyChain;

  /** Log any custody event */
  logCustodyEvent = logCustodyEvent;
}

/** Singleton instance for convenience */
export const chainOfCustodyService = ChainOfCustodyService.getInstance();
