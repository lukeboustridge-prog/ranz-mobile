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
  readAsStringAsync,
  getInfoAsync,
  EncodingType,
} from "expo-file-system/legacy";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import { savePhoto, getPhotosForReport, addToSyncQueue } from "../lib/sqlite";
import { getOrCreateDeviceId } from "../lib/storage";
import type { LocalPhoto } from "../types/database";
import type { PhotoType, QuickTag } from "../types/shared";

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
      console.error("[PhotoService] Camera permission error:", error);
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
      console.error("[PhotoService] Location permission error:", error);
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
        console.warn("[PhotoService] Location permission not granted");
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
      console.log("[PhotoService] Location tracking started");
    } catch (error) {
      console.error("[PhotoService] Failed to start location tracking:", error);
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
        console.warn("[PhotoService] No GPS data available - photo will have null coordinates");
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

      this.emitProgress("Processing image...");

      // Generate unique filename
      const filename = `${localId}.jpg`;
      const localUri = `${documentDirectory}photos/${filename}`;

      // Ensure photos directory exists
      const photosDir = `${documentDirectory}photos`;
      const dirInfo = await getInfoAsync(photosDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(photosDir, { intermediates: true });
      }

      // Move photo to permanent location
      await moveAsync({
        from: photo.uri,
        to: localUri,
      });

      this.emitProgress("Generating hash...");

      // Generate SHA-256 hash for chain of custody
      const fileContent = await readAsStringAsync(localUri, {
        encoding: EncodingType.Base64,
      });
      const originalHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fileContent
      );

      // Get file info
      const fileInfo = await getInfoAsync(localUri);
      const fileSize = (fileInfo as { size?: number }).size || 0;

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
        originalFilename: filename,
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

      // Log chain of custody event
      console.log(`[PhotoService] Photo captured:`, {
        id,
        timestamp,
        gps: gpsData ? `${gpsData.latitude.toFixed(6)}, ${gpsData.longitude.toFixed(6)}` : "N/A",
        accuracy: gpsData?.accuracy ?? "N/A",
        hash: originalHash.substring(0, 16) + "...",
        device: `${cameraMake} ${cameraModel}`,
        deviceId,
      });

      this.emitProgress("Photo captured successfully!");

      return {
        success: true,
        metadata,
      };
    } catch (error) {
      console.error("[PhotoService] Capture error:", error);
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
   * Delete a photo
   */
  async deletePhoto(photoId: string): Promise<void> {
    // TODO: Implement photo deletion
    // - Remove from file system
    // - Remove from database
    // - Add delete operation to sync queue
    console.log(`[PhotoService] Would delete photo ${photoId}`);
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
      console.error("[PhotoService] Failed to read photo for upload:", error);
      return null;
    }
  }

  /**
   * Validate photo integrity using hash
   */
  async validatePhotoIntegrity(photoId: string, localUri: string, expectedHash: string): Promise<boolean> {
    try {
      const fileContent = await readAsStringAsync(localUri, {
        encoding: EncodingType.Base64,
      });
      const currentHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fileContent
      );

      const isValid = currentHash === expectedHash;

      if (!isValid) {
        console.warn(`[PhotoService] Hash mismatch for photo ${photoId}`);
        console.warn(`  Expected: ${expectedHash}`);
        console.warn(`  Current:  ${currentHash}`);
      }

      return isValid;
    } catch (error) {
      console.error("[PhotoService] Failed to validate photo integrity:", error);
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
