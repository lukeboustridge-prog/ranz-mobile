/**
 * Services Index
 * Central export point for all service modules
 *
 * Usage:
 * ```typescript
 * import { evidenceService, chainOfCustodyService, photoService } from "./services";
 * ```
 */

// Evidence integrity services
export {
  generateHashFromBase64,
  generateFileHash,
  verifyFileHash,
  evidenceService,
  EvidenceService,
} from "./evidence-service";

export {
  logCustodyEvent,
  getCustodyChain,
  logCapture,
  logStorage,
  logView,
  logSync,
  logIncludeInReport,
  logVerification,
  logExport,
  chainOfCustodyService,
  ChainOfCustodyService,
} from "./chain-of-custody";

// Photo capture service
export {
  photoService,
  requestCameraPermission,
  requestLocationPermission,
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
  getGPSAccuracyStatus,
} from "./photo-service";

// Re-export types for convenience
export type { PhotoMetadata, CaptureResult, LocationData } from "./photo-service";
