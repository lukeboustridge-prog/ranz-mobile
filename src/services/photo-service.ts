/**
 * Photo Service
 * Camera capture with GPS and EXIF metadata for evidence integrity
 */

import * as Camera from "expo-camera";
import * as Location from "expo-location";
import {
  documentDirectory,
  makeDirectoryAsync,
  moveAsync,
  copyAsync,
  readAsStringAsync,
  writeAsStringAsync,
  getInfoAsync,
  deleteAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { embedGPSInEXIF } from "../lib/exif-utils";
import * as Device from "expo-device";
import {
  savePhoto,
  getPhotosForReport,
  addToSyncQueue,
  deletePhoto as deletePhotoFromDB,
  getPhotoById,
  getUser,
} from "../lib/sqlite";
import { getOrCreateDeviceId } from "../lib/storage";
import { photoLogger } from "../lib/logger";
import {
  ensureStorageDirectories,
  copyToOriginals,
  getWorkingPath,
  getOriginalPath,
  STORAGE_PATHS,
} from "../lib/file-storage";
import { generateHashFromBase64, verifyFileHash } from "./evidence-service";
import { logCapture, logStorage, logVerification, logCustodyEvent } from "./chain-of-custody";
import type { LocalPhoto } from "../types/database";
import type { PhotoType, QuickTag } from "../types/shared";
import { getInfoAsync as getFileInfo } from "expo-file-system/legacy";

// ============================================
// TYPES
// ============================================

export interface PhotoMetadata {
  id: string;
  reportId: string;
  photoType: PhotoType;
  quickTag: QuickTag | null;
  timestamp: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAltitude: number | null;
  gpsAccuracy: number;
  cameraMake: string;
  cameraModel: string;
  exposureTime: number | null;
  fNumber: number | null;
  iso: number | null;
  focalLength: number | null;
  originalHash: string;
  localUri: string;
  syncStatus: "captured" | "processing" | "uploaded" | "synced" | "error";
}

export interface CaptureResult {
  success: boolean;
  metadata?: PhotoMetadata;
  error?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

type CaptureProgressCallback = (status: string) => void;

// ============================================
// PHOTO SERVICE CLASS
// ============================================

class PhotoService {
  private captureProgressCallback: CaptureProgressCallback | null = null;
  private currentLocation: LocationData | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private isLocationTracking: boolean = false;

  /**
   * Register capture progress callback
   */
  onCaptureProgress(callback: CaptureProgressCallback): void {
    this.captureProgressCallback = callback;
  }

  /**
   * Emit capture progress
   */
  private emitProgress(status: string): void {
    if (this.captureProgressCallback) {
      this.captureProgressCallback(status);
    }
  }

  /**
   * Request camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await Camera.Camera.requestCameraPermissionsAsync();
      return status === "granted";
    } catch (error) {
      photoLogger.exception("Camera permission error", error);
      return false;
    }
  }

  /**
   * Request location permission
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === "granted";
    } catch (error) {
      photoLogger.exception("Location permission error", error);
      return false;
    }
  }

  /**
   * Start location tracking for continuous GPS updates
   */
  async startLocationTracking(): Promise<void> {
    if (this.isLocationTracking) return;

    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        photoLogger.warn("Location permission not granted");
        return;
      }

      // Get initial location
      this.emitProgress("Acquiring GPS signal...");
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      this.currentLocation = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        altitude: initialLocation.coords.altitude,
        accuracy: initialLocation.coords.accuracy || 999,
        timestamp: initialLocation.timestamp,
      };

      // Start watching for location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 5, // Or when moved 5 meters
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
            accuracy: location.coords.accuracy || 999,
            timestamp: location.timestamp,
          };
        }
      );

      this.isLocationTracking = true;
      photoLogger.info("Location tracking started");
    } catch (error) {
      photoLogger.exception("Failed to start location tracking", error);
    }
  }

  /**
   * Stop location tracking
   */
  stopLocationTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.isLocationTracking = false;
    this.currentLocation = null;
  }

  /**
   * Get current location
   */
  getCurrentLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Get GPS accuracy status
   */
  getGPSAccuracyStatus(): { accuracy: number; status: "good" | "fair" | "poor" | "none" } {
    if (!this.currentLocation) {
      return { accuracy: 999, status: "none" };
    }

    const accuracy = this.currentLocation.accuracy;
    let status: "good" | "fair" | "poor" | "none";

    if (accuracy <= 10) {
      status = "good";
    } else if (accuracy <= 30) {
      status = "fair";
    } else {
      status = "poor";
    }

    return { accuracy, status };
  }

  /**
   * Capture a photo with full metadata
   */
  async capturePhoto(
    cameraRef: Camera.CameraView,
    photoType: PhotoType,
    reportId: string,
    defectId?: string,
    roofElementId?: string,
    quickTag?: QuickTag
  ): Promise<CaptureResult> {
    try {
      this.emitProgress("Preparing capture...");

      // Generate unique IDs
      const localId = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const id = localId; // Use same ID initially

      // Get current timestamp in UTC
      const timestamp = new Date().toISOString();

      // Get device info
      const cameraMake = Device.manufacturer || "Unknown";
      const cameraModel = Device.modelName || "Unknown";
      const deviceId = await getOrCreateDeviceId();

      // Get current GPS data
      const gpsData = this.currentLocation;
      if (!gpsData) {
        photoLogger.warn("No GPS data available - photo will have null coordinates");
      }

      this.emitProgress("Capturing image...");

      // Take the photo
      const photo = await cameraRef.takePictureAsync({
        quality: 0.9,
        exif: true,
        skipProcessing: false,
      });

      if (!photo || !photo.uri) {
        throw new Error("Failed to capture photo");
      }

      // =========================================
      // EVIDENCE INTEGRITY: Hash BEFORE any file operations
      // =========================================
      this.emitProgress("Generating evidence hash...");

      // Read the captured photo content immediately
      const base64Content = await readAsStringAsync(photo.uri, {
        encoding: EncodingType.Base64,
      });

      // Generate SHA-256 hash BEFORE any file operations
      // This proves the hash reflects the original captured data
      const hashResult = await generateHashFromBase64(base64Content);
      const originalHash = hashResult.hash;

      // =========================================
      // EVIDENCE STORAGE: Copy to immutable originals
      // =========================================
      this.emitProgress("Storing evidence...");

      // Ensure storage directories exist
      await ensureStorageDirectories();

      // Generate filenames
      const filename = `${localId}.jpg`;
      const originalFilename = `orig_${filename}`;

      // Copy to immutable originals directory (NEVER modified after this)
      const originalPath = await copyToOriginals(photo.uri, originalFilename);

      // =========================================
      // WORKING COPY: Embed GPS in EXIF for external tool compatibility
      // =========================================
      this.emitProgress("Embedding GPS in working copy...");

      let workingBase64 = base64Content;
      let exifEmbedded = false;

      // Only embed GPS if we have valid coordinates
      if (gpsData && gpsData.latitude && gpsData.longitude) {
        try {
          workingBase64 = embedGPSInEXIF(base64Content, {
            lat: gpsData.latitude,
            lng: gpsData.longitude,
            altitude: gpsData.altitude ?? undefined,
            timestamp: new Date(timestamp),
          });
          exifEmbedded = true;
          photoLogger.debug("GPS embedded in working copy EXIF", {
            lat: gpsData.latitude.toFixed(6),
            lng: gpsData.longitude.toFixed(6),
          });
        } catch (exifError) {
          // Non-fatal: working copy will just not have EXIF GPS
          // Original hash and metadata are still valid
          photoLogger.warn("Failed to embed GPS in EXIF, using original", {
            error: exifError instanceof Error ? exifError.message : "Unknown error",
          });
        }
      }

      // Write working copy (with or without embedded GPS)
      const workingPath = getWorkingPath(filename);
      await writeAsStringAsync(workingPath, workingBase64, {
        encoding: EncodingType.Base64,
      });

      // Clean up temp file
      await deleteAsync(photo.uri, { idempotent: true });

      const localUri = workingPath;

      // Get file info
      const fileInfo = await getInfoAsync(localUri);
      const fileSize = (fileInfo as { size?: number }).size || 0;

      // =========================================
      // CHAIN OF CUSTODY: Log evidence events
      // =========================================
      this.emitProgress("Logging custody chain...");

      // Get current user for audit log
      const currentUser = await getUser();
      const userId = currentUser?.id || "unknown";
      const userName = currentUser?.name || "Unknown User";

      // Log CAPTURED event
      await logCapture(
        "photo",
        id,
        userId,
        userName,
        originalHash,
        `Captured with ${cameraMake} ${cameraModel}, GPS accuracy: ${gpsData?.accuracy ?? "N/A"}m`
      );

      // Log STORED event
      await logStorage(
        "photo",
        id,
        userId,
        userName,
        originalHash,
        originalPath
      );

      // Log GPS EXIF embedding status (for forensic audit trail)
      if (exifEmbedded) {
        await logCustodyEvent(
          "STORED",
          "photo",
          id,
          userId,
          userName,
          originalHash,
          `GPS embedded in working copy EXIF: ${gpsData?.latitude?.toFixed(6)}, ${gpsData?.longitude?.toFixed(6)}`
        );
      } else if (gpsData?.latitude && gpsData?.longitude) {
        // GPS was available but EXIF embedding failed
        await logCustodyEvent(
          "STORED",
          "photo",
          id,
          userId,
          userName,
          originalHash,
          `GPS EXIF embedding failed - coordinates stored in metadata only`
        );
      }

      // Build metadata object
      const metadata: PhotoMetadata = {
        id,
        reportId,
        photoType,
        quickTag: quickTag ?? null,
        timestamp,
        gpsLat: gpsData?.latitude ?? null,
        gpsLng: gpsData?.longitude ?? null,
        gpsAltitude: gpsData?.altitude ?? null,
        gpsAccuracy: gpsData?.accuracy ?? 999,
        cameraMake,
        cameraModel,
        exposureTime: photo.exif?.ExposureTime ?? null,
        fNumber: photo.exif?.FNumber ?? null,
        iso: photo.exif?.ISO ?? null,
        focalLength: photo.exif?.FocalLength ?? null,
        originalHash,
        localUri,
        syncStatus: "captured",
      };

      this.emitProgress("Saving to database...");

      // Save to local database
      const localPhoto: LocalPhoto = {
        id,
        reportId,
        defectId: defectId ?? null,
        roofElementId: roofElementId ?? null,
        localUri,
        thumbnailUri: null, // TODO: Generate thumbnail
        filename,
        originalFilename,
        mimeType: "image/jpeg",
        fileSize,
        photoType,
        quickTag: quickTag ?? null,
        capturedAt: timestamp,
        gpsLat: gpsData?.latitude ?? null,
        gpsLng: gpsData?.longitude ?? null,
        gpsAltitude: gpsData?.altitude ?? null,
        gpsAccuracy: gpsData?.accuracy ?? null,
        cameraMake,
        cameraModel,
        exposureTime: photo.exif?.ExposureTime ?? null,
        fNumber: photo.exif?.FNumber ?? null,
        iso: photo.exif?.ISO ?? null,
        focalLength: photo.exif?.FocalLength ?? null,
        originalHash,
        annotationsJson: null,
        annotatedUri: null,
        measurementsJson: null,
        calibrationJson: null,
        measuredUri: null,
        caption: null,
        sortOrder: 0,
        syncStatus: "captured",
        uploadedUrl: null,
        syncedAt: null,
        lastSyncError: null,
        createdAt: timestamp,
      };

      await savePhoto(localPhoto);

      // Add to sync queue
      await addToSyncQueue("photo", id, "create", {
        reportId,
        defectId,
        roofElementId,
        photoType,
        metadata,
      });

      // Log chain of custody event (sensitive data handled by logger)
      photoLogger.info("Photo captured with evidence integrity", {
        id,
        timestamp,
        hasGps: !!gpsData,
        gpsAccuracy: gpsData?.accuracy,
        hashPrefix: originalHash.substring(0, 8),
        device: `${cameraMake} ${cameraModel}`,
        originalPath,
      });

      this.emitProgress("Photo captured successfully!");

      return {
        success: true,
        metadata,
      };
    } catch (error) {
      photoLogger.exception("Photo capture failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown capture error",
      };
    }
  }

  /**
   * Get all photos for a report
   */
  async getPhotosForReport(reportId: string): Promise<PhotoMetadata[]> {
    const photos = await getPhotosForReport(reportId);

    return photos.map((p) => ({
      id: p.id,
      reportId: p.reportId,
      photoType: p.photoType as PhotoType,
      quickTag: p.quickTag as QuickTag | null,
      timestamp: p.capturedAt || p.createdAt,
      gpsLat: p.gpsLat,
      gpsLng: p.gpsLng,
      gpsAltitude: p.gpsAltitude,
      gpsAccuracy: p.gpsAccuracy || 999,
      cameraMake: p.cameraMake || "Unknown",
      cameraModel: p.cameraModel || "Unknown",
      exposureTime: p.exposureTime,
      fNumber: p.fNumber,
      iso: p.iso,
      focalLength: p.focalLength,
      originalHash: p.originalHash,
      localUri: p.localUri,
      syncStatus: p.syncStatus as PhotoMetadata["syncStatus"],
    }));
  }

  /**
   * Delete a photo from file system, database, and queue for sync
   */
  async deletePhoto(photoId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get photo details first
      const photo = await getPhotoById(photoId);
      if (!photo) {
        photoLogger.warn("Photo not found for deletion", { photoId });
        return { success: false, error: "Photo not found" };
      }

      // Delete from file system
      if (photo.localUri) {
        const fileInfo = await getFileInfo(photo.localUri);
        if (fileInfo.exists) {
          await deleteAsync(photo.localUri, { idempotent: true });
          photoLogger.debug("Deleted photo file", { photoId });
        }
      }

      // Delete thumbnail if exists
      if (photo.thumbnailUri) {
        const thumbInfo = await getFileInfo(photo.thumbnailUri);
        if (thumbInfo.exists) {
          await deleteAsync(photo.thumbnailUri, { idempotent: true });
        }
      }

      // Delete annotated version if exists
      if (photo.annotatedUri) {
        const annotatedInfo = await getFileInfo(photo.annotatedUri);
        if (annotatedInfo.exists) {
          await deleteAsync(photo.annotatedUri, { idempotent: true });
        }
      }

      // Delete measured version if exists
      if (photo.measuredUri) {
        const measuredInfo = await getFileInfo(photo.measuredUri);
        if (measuredInfo.exists) {
          await deleteAsync(photo.measuredUri, { idempotent: true });
        }
      }

      // Remove from database
      await deletePhotoFromDB(photoId);

      // Add to sync queue for server deletion
      await addToSyncQueue("photo", photoId, "delete", {
        reportId: photo.reportId,
        originalHash: photo.originalHash,
      });

      photoLogger.info("Photo deleted", { photoId, reportId: photo.reportId });

      return { success: true };
    } catch (error) {
      photoLogger.exception("Failed to delete photo", error, { photoId });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete photo",
      };
    }
  }

  /**
   * Get photo file for upload
   */
  async getPhotoForUpload(
    photoId: string
  ): Promise<{ file: Blob; metadata: PhotoMetadata } | null> {
    const photos = await this.getPhotosForReport(""); // TODO: Need proper method
    const photo = photos.find((p) => p.id === photoId);

    if (!photo) return null;

    try {
      const fileContent = await readAsStringAsync(photo.localUri, {
        encoding: EncodingType.Base64,
      });

      // Convert base64 to Blob
      const byteCharacters = atob(fileContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      return { file: blob, metadata: photo };
    } catch (error) {
      photoLogger.exception("Failed to read photo for upload", error, { photoId });
      return null;
    }
  }

  /**
   * Validate photo integrity using hash
   * Verifies against the original in immutable storage
   */
  async validatePhotoIntegrity(
    photoId: string,
    expectedHash: string
  ): Promise<boolean> {
    try {
      // Get the photo to find its original filename
      const photo = await getPhotoById(photoId);
      if (!photo) {
        photoLogger.warn("Photo not found for integrity validation", { photoId });
        return false;
      }

      // Verify using the original file (in immutable originals directory)
      const originalPath = getOriginalPath(photo.originalFilename);
      const result = await verifyFileHash(originalPath, expectedHash);

      // Get current user for audit log
      const currentUser = await getUser();
      const userId = currentUser?.id || "unknown";
      const userName = currentUser?.name || "Unknown User";

      // Log verification event
      await logVerification(
        "photo",
        photoId,
        userId,
        userName,
        result.isValid,
        expectedHash,
        result.actualHash
      );

      if (!result.isValid) {
        photoLogger.warn("Hash mismatch - photo may have been modified", {
          photoId,
          expectedHashPrefix: expectedHash.substring(0, 8),
          actualHashPrefix: result.actualHash.substring(0, 8),
        });
      }

      return result.isValid;
    } catch (error) {
      photoLogger.exception("Failed to validate photo integrity", error, { photoId });
      return false;
    }
  }
}

// Export singleton instance
export const photoService = new PhotoService();

// Export convenience functions
export async function requestCameraPermission(): Promise<boolean> {
  return photoService.requestCameraPermission();
}

export async function requestLocationPermission(): Promise<boolean> {
  return photoService.requestLocationPermission();
}

export async function startLocationTracking(): Promise<void> {
  return photoService.startLocationTracking();
}

export function stopLocationTracking(): void {
  photoService.stopLocationTracking();
}

export function getCurrentLocation(): LocationData | null {
  return photoService.getCurrentLocation();
}

export function getGPSAccuracyStatus(): { accuracy: number; status: "good" | "fair" | "poor" | "none" } {
  return photoService.getGPSAccuracyStatus();
}
