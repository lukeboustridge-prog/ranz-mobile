/**
 * Video Service
 * Video recording and management for walkthrough documentation
 *
 * CRITICAL: Video files have SHA-256 hash generated IMMEDIATELY after recording
 * stops, BEFORE any file operations. This ensures evidence integrity for legal
 * admissibility under the NZ Evidence Act 2006.
 */

import { CameraView } from "expo-camera";
import {
  documentDirectory,
  makeDirectoryAsync,
  getInfoAsync,
  deleteAsync,
  readAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import * as Location from "expo-location";
import {
  saveVideo,
  getVideosForReport,
  getVideoById,
  deleteVideo as deleteVideoFromDb,
  addToSyncQueue,
} from "../lib/sqlite";
import {
  getCurrentLocation,
  type LocationData,
} from "./photo-service";
import { generateHashFromBase64 } from "./evidence-service";
import { logCapture, logStorage } from "./chain-of-custody";
import type { LocalVideo } from "../types/database";

// ============================================
// TYPES
// ============================================

/**
 * GPS track point captured during video recording
 * Collected at 1-second intervals for walkthrough evidence
 */
export interface GPSTrackPoint {
  timestamp: number;     // milliseconds from recording start
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number;
}

export interface VideoMetadata {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;
  localUri: string;
  thumbnailUri: string | null;
  filename: string;
  durationMs: number;
  title: string | null;
  description: string | null;
  recordedAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  fileSize: number;
  originalHash?: string;
  gpsTrack?: GPSTrackPoint[];
}

export interface RecordingResult {
  success: boolean;
  metadata?: VideoMetadata;
  error?: string;
}

type RecordingProgressCallback = (durationMs: number) => void;

// ============================================
// VIDEO SERVICE CLASS
// ============================================

class VideoService {
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private progressCallback: RecordingProgressCallback | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private currentRecordingPromise: Promise<{ uri: string } | undefined> | null = null;
  private gpsTrack: GPSTrackPoint[] = [];
  private gpsTrackInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Register progress callback for recording duration updates
   */
  onRecordingProgress(callback: RecordingProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Start video recording
   */
  async startRecording(
    cameraRef: CameraView,
    reportId: string,
    defectId?: string,
    roofElementId?: string
  ): Promise<boolean> {
    if (this.isRecording) {
      console.warn("[VideoService] Already recording");
      return false;
    }

    try {
      // Ensure videos directory exists
      const videosDir = `${documentDirectory}videos`;
      const dirInfo = await getInfoAsync(videosDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(videosDir, { intermediates: true });
      }

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Start progress updates
      if (this.progressCallback) {
        this.progressInterval = setInterval(() => {
          const durationMs = Date.now() - this.recordingStartTime;
          this.progressCallback?.(durationMs);
        }, 100);
      }

      // Start GPS track collection at 1-second intervals
      this.gpsTrack = [];
      this.gpsTrackInterval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          this.gpsTrack.push({
            timestamp: Date.now() - this.recordingStartTime,
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            altitude: location.coords.altitude,
            accuracy: location.coords.accuracy ?? 0,
          });
        } catch (error) {
          // Don't fail recording if GPS fails - just skip this point
          console.warn("[VideoService] GPS track point failed:", error);
        }
      }, 1000); // 1-second intervals

      // Start recording - this returns a promise that resolves when recording stops
      this.currentRecordingPromise = cameraRef.recordAsync({
        maxDuration: 300, // 5 minutes max
      });

      console.log("[VideoService] Recording started with GPS tracking");
      return true;
    } catch (error) {
      console.error("[VideoService] Failed to start recording:", error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop video recording and save
   */
  async stopRecording(
    cameraRef: CameraView,
    reportId: string,
    defectId?: string,
    roofElementId?: string
  ): Promise<RecordingResult> {
    if (!this.isRecording || !this.currentRecordingPromise) {
      return { success: false, error: "No active recording" };
    }

    try {
      // Stop progress updates
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }

      // Stop GPS tracking
      if (this.gpsTrackInterval) {
        clearInterval(this.gpsTrackInterval);
        this.gpsTrackInterval = null;
      }

      // Capture final GPS point
      try {
        const finalLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        this.gpsTrack.push({
          timestamp: Date.now() - this.recordingStartTime,
          lat: finalLocation.coords.latitude,
          lng: finalLocation.coords.longitude,
          altitude: finalLocation.coords.altitude,
          accuracy: finalLocation.coords.accuracy ?? 0,
        });
      } catch (error) {
        console.warn("[VideoService] Final GPS point failed:", error);
      }

      const gpsTrackJson = this.gpsTrack.length > 0 ? JSON.stringify(this.gpsTrack) : null;

      const durationMs = Date.now() - this.recordingStartTime;

      // Stop the recording
      cameraRef.stopRecording();

      // Wait for the recording to finish and get the URI
      const result = await this.currentRecordingPromise;

      if (!result || !result.uri) {
        throw new Error("Recording URI not available");
      }

      const uri = result.uri;

      // =========================================
      // EVIDENCE INTEGRITY: Hash BEFORE any file operations
      // =========================================
      // Read video as base64 and generate SHA-256 hash immediately
      // This ensures the hash reflects the exact captured data
      const base64Content = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      const hashResult = await generateHashFromBase64(base64Content);
      const originalHash = hashResult.hash;

      console.log("[VideoService] Evidence hash generated:", originalHash.substring(0, 16) + "...");

      // Generate unique ID and filename
      const id = `video_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const filename = `${id}.mp4`;
      const timestamp = new Date().toISOString();

      // Get GPS data
      const gpsData = getCurrentLocation();

      // Get file info
      const fileInfo = await getInfoAsync(uri);
      const fileSize = (fileInfo as { size?: number }).size || 0;

      // Build metadata
      const metadata: VideoMetadata = {
        id,
        reportId,
        defectId: defectId || null,
        roofElementId: roofElementId || null,
        localUri: uri,
        thumbnailUri: null, // TODO: Generate thumbnail
        filename,
        durationMs,
        title: null,
        description: null,
        recordedAt: timestamp,
        gpsLat: gpsData?.latitude ?? null,
        gpsLng: gpsData?.longitude ?? null,
        fileSize,
        originalHash,
        gpsTrack: this.gpsTrack.length > 0 ? [...this.gpsTrack] : undefined,
      };

      // Save to database
      const localVideo: LocalVideo = {
        id,
        reportId,
        defectId: defectId || null,
        roofElementId: roofElementId || null,
        localUri: uri,
        thumbnailUri: null,
        filename,
        originalFilename: filename,
        mimeType: "video/mp4",
        fileSize,
        durationMs,
        title: null,
        description: null,
        recordedAt: timestamp,
        gpsLat: gpsData?.latitude ?? null,
        gpsLng: gpsData?.longitude ?? null,
        originalHash,
        gpsTrackJson,
        syncStatus: "draft",
        uploadedUrl: null,
        syncedAt: null,
        lastSyncError: null,
        createdAt: timestamp,
      };

      await saveVideo(localVideo);

      // =========================================
      // CHAIN OF CUSTODY: Log capture and storage
      // =========================================
      // Note: userId and userName should come from auth context
      // For now, use placeholders that will be replaced when auth integration is complete
      const userId = "local-user"; // TODO: Get from auth context
      const userName = "Inspector"; // TODO: Get from auth context

      await logCapture(
        "video",
        id,
        userId,
        userName,
        originalHash,
        `Video recorded: ${durationMs}ms, ${formatVideoFileSize(fileSize)}`
      );

      await logStorage(
        "video",
        id,
        userId,
        userName,
        originalHash,
        uri
      );

      // Add to sync queue with GPS track
      await addToSyncQueue("video", id, "create", {
        reportId,
        defectId,
        roofElementId,
        metadata: {
          ...metadata,
          originalHash,
          gpsTrack: this.gpsTrack.length > 0 ? this.gpsTrack : undefined,
        },
      });

      console.log("[VideoService] Recording saved with evidence integrity:", {
        id,
        durationMs,
        fileSize,
        originalHash: originalHash.substring(0, 16) + "...",
        gpsTrackPoints: this.gpsTrack.length,
      });

      // Reset state
      this.isRecording = false;
      this.currentRecordingPromise = null;

      return { success: true, metadata };
    } catch (error) {
      console.error("[VideoService] Failed to stop recording:", error);
      this.isRecording = false;
      this.currentRecordingPromise = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save recording",
      };
    }
  }

  /**
   * Cancel and discard current recording
   */
  async cancelRecording(cameraRef: CameraView): Promise<void> {
    if (!this.isRecording) return;

    try {
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }

      // Stop GPS tracking
      if (this.gpsTrackInterval) {
        clearInterval(this.gpsTrackInterval);
        this.gpsTrackInterval = null;
      }
      this.gpsTrack = [];

      cameraRef.stopRecording();

      // Wait for recording to finish
      if (this.currentRecordingPromise) {
        const result = await this.currentRecordingPromise;
        if (result?.uri) {
          await deleteAsync(result.uri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error("[VideoService] Failed to cancel recording:", error);
    } finally {
      this.isRecording = false;
      this.currentRecordingPromise = null;
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording duration
   */
  getCurrentDuration(): number {
    if (!this.isRecording) return 0;
    return Date.now() - this.recordingStartTime;
  }

  /**
   * Parse GPS track JSON string into GPSTrackPoint array
   */
  private parseGpsTrack(gpsTrackJson: string | null): GPSTrackPoint[] | undefined {
    if (!gpsTrackJson) return undefined;
    try {
      return JSON.parse(gpsTrackJson) as GPSTrackPoint[];
    } catch {
      console.warn("[VideoService] Failed to parse GPS track JSON");
      return undefined;
    }
  }

  /**
   * Get videos for a report
   */
  async getVideosForReport(reportId: string): Promise<VideoMetadata[]> {
    const videos = await getVideosForReport(reportId);
    return videos.map((v) => ({
      id: v.id,
      reportId: v.reportId,
      defectId: v.defectId,
      roofElementId: v.roofElementId,
      localUri: v.localUri,
      thumbnailUri: v.thumbnailUri,
      filename: v.filename,
      durationMs: v.durationMs,
      title: v.title,
      description: v.description,
      recordedAt: v.recordedAt,
      gpsLat: v.gpsLat,
      gpsLng: v.gpsLng,
      fileSize: v.fileSize,
      originalHash: v.originalHash,
      gpsTrack: this.parseGpsTrack(v.gpsTrackJson),
    }));
  }

  /**
   * Get a video by ID
   */
  async getVideoById(id: string): Promise<VideoMetadata | null> {
    const video = await getVideoById(id);
    if (!video) return null;

    return {
      id: video.id,
      reportId: video.reportId,
      defectId: video.defectId,
      roofElementId: video.roofElementId,
      localUri: video.localUri,
      thumbnailUri: video.thumbnailUri,
      filename: video.filename,
      durationMs: video.durationMs,
      title: video.title,
      description: video.description,
      recordedAt: video.recordedAt,
      gpsLat: video.gpsLat,
      gpsLng: video.gpsLng,
      fileSize: video.fileSize,
      originalHash: video.originalHash,
      gpsTrack: this.parseGpsTrack(video.gpsTrackJson),
    };
  }

  /**
   * Delete a video
   */
  async deleteVideo(id: string, localUri: string): Promise<void> {
    try {
      // Delete from file system
      await deleteAsync(localUri, { idempotent: true });

      // Delete from database
      await deleteVideoFromDb(id);

      // Add delete to sync queue
      await addToSyncQueue("video", id, "delete", { id });

      console.log("[VideoService] Video deleted:", id);
    } catch (error) {
      console.error("[VideoService] Failed to delete video:", error);
      throw error;
    }
  }

  /**
   * Format duration for display (mm:ss)
   */
  formatDuration(durationMs: number): string {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// Export singleton instance
export const videoService = new VideoService();

// Export convenience functions
export function formatVideoDuration(durationMs: number): string {
  return videoService.formatDuration(durationMs);
}

export function formatVideoFileSize(bytes: number): string {
  return videoService.formatFileSize(bytes);
}
