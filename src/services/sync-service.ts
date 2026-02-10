/**
 * Sync Service
 * Comprehensive offline sync engine for two-way synchronization
 * - Down-sync: Server → Mobile (bootstrap, incremental updates)
 * - Up-sync: Mobile → Server (reports, photos, defects, elements, compliance)
 */

import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import { FileSystemUploadType } from "expo-file-system/legacy";
import {
  fetchBootstrapData,
  withRetry,
  checkApiHealth,
  apiClient,
} from "../lib/api";
import {
  saveUser,
  getUser,
  saveChecklist,
  getAllChecklists,
  saveTemplate,
  getAllTemplates,
  saveReport,
  getReport,
  getAllReports,
  getPendingSyncReports,
  getRoofElementsForReport,
  getDefectsForReport,
  getPhotosForReport,
  getComplianceAssessment,
  getPendingUploadPhotos,
  updatePhotoSyncStatus,
  getPendingUploadVideos,
  updateVideoSyncStatus,
  getPendingUploadVoiceNotes,
  updateVoiceNoteSyncStatus,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueAttempt,
  getSyncQueueCount,
  clearSyncQueue,
  getSyncState as getDbSyncState,
  updateSyncState as updateDbSyncState,
  getReportWithRelations,
  getRetryableItems,
  markPermanentlyFailed,
  MAX_SYNC_RETRY_ATTEMPTS,
  getUnsyncedCustodyEvents,
  markCustodyEventsSynced,
} from "../lib/sqlite";
import { saveLastSyncAt, getLastSyncAt, getOrCreateDeviceId, getSyncSettings } from "../lib/storage";
import type {
  LocalUser,
  LocalChecklist,
  LocalTemplate,
  LocalReport,
  LocalRoofElement,
  LocalDefect,
  LocalPhoto,
  LocalVideo,
  LocalVoiceNote,
  LocalComplianceAssessment,
} from "../types/database";
import { uploadWithResume, shouldUseChunkedUpload } from "../lib/chunked-upload";
import { logSync as logCustodySync } from "./chain-of-custody";
import { verifySyncedEvidence } from "./evidence-service";
import type {
  SyncProgress,
  SyncResult,
  SyncError,
  SyncState,
  NetworkStatus,
  DetailedSyncProgress,
} from "../types/sync";
import type {
  Checklist,
  ReportTemplate,
  ReportSummary,
  User,
  SyncUploadPayload,
  SyncUploadResponse,
  ReportSync,
  RoofElementSync,
  DefectSync,
  ComplianceAssessmentSync,
  PhotoMetadataSync,
} from "../types/shared";

// ============================================
// CONSTANTS
// ============================================

const MAX_RETRY_ATTEMPTS = 3;
const SYNC_BATCH_SIZE = 10; // Max reports per sync batch
const PHOTO_UPLOAD_TIMEOUT = 120000; // 2 minutes for photo upload
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ============================================
// TYPES
// ============================================

type ProgressCallback = (status: string, progress: number) => void;
export type DetailedProgressCallback = (progress: DetailedSyncProgress) => void;
type ErrorCallback = (error: SyncError) => void;
type StatusCallback = (state: SyncState) => void;
type ConflictCallback = (conflicts: Array<{ reportId: string; resolution: string }>) => void;
type SyncCompleteCallback = (result: SyncResult) => void;

interface UploadResult {
  success: boolean;
  reportsSynced: number;
  photosSynced: number;
  errors: SyncError[];
  conflicts: number;
}

// ============================================
// SYNC ENGINE CLASS
// ============================================

class SyncEngine {
  private progressCallback: ProgressCallback | null = null;
  private detailedProgressCallback: DetailedProgressCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private conflictCallback: ConflictCallback | null = null;
  private syncCompleteCallback: SyncCompleteCallback | null = null;
  private isSyncing: boolean = false;
  private isOnline: boolean = false;
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initializeNetworkListener();
  }

  /**
   * Get current user info for custody logging
   * Returns userId and userName for audit trail
   */
  private async getCurrentUser(): Promise<{ userId: string; userName: string }> {
    try {
      const user = await getUser();
      if (user) {
        return { userId: user.id, userName: user.name };
      }
    } catch (error) {
      console.warn('[Sync] Could not get user for custody logging:', error);
    }
    // Fallback for when user not available
    return { userId: 'system', userName: 'System Sync' };
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Used for retry delays between sync attempts
   */
  private calculateBackoff(attemptCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute max
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    const jitter = Math.random() * 500; // Up to 500ms jitter
    return exponentialDelay + jitter;
  }

  /**
   * Handle sync failure with retry tracking
   * Marks items as permanently failed after exceeding max attempts
   */
  private async handleSyncFailure(
    queueItemId: number | undefined,
    entityType: string,
    entityId: string,
    error: string,
    attemptCount: number
  ): Promise<void> {
    if (!queueItemId) return;

    if (attemptCount >= MAX_SYNC_RETRY_ATTEMPTS - 1) {
      // Mark as permanently failed
      await markPermanentlyFailed(queueItemId, error);
      console.warn(
        `[Sync] ${entityType} ${entityId} marked as permanently failed after ${attemptCount + 1} attempts`
      );
    } else {
      // Update attempt count for retry
      await updateSyncQueueAttempt(queueItemId, error);
      console.log(
        `[Sync] ${entityType} ${entityId} will retry (attempt ${attemptCount + 1}/${MAX_SYNC_RETRY_ATTEMPTS})`
      );
    }
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  /**
   * Initialize network state listener
   */
  private initializeNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true && state.isInternetReachable !== false;

      console.log(`[Sync] Network state changed: ${this.isOnline ? "online" : "offline"}`);

      // Trigger sync when coming back online
      if (!wasOnline && this.isOnline) {
        console.log("[Sync] Network restored - triggering sync");
        this.syncPendingChanges().catch(console.error);
      }

      // Notify status listeners
      this.notifyStatusChange();
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSync();
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  // ============================================
  // CALLBACKS
  // ============================================

  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  onStatusChange(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  onConflict(callback: ConflictCallback): void {
    this.conflictCallback = callback;
  }

  onSyncComplete(callback: SyncCompleteCallback): void {
    this.syncCompleteCallback = callback;
  }

  onDetailedProgress(callback: DetailedProgressCallback): void {
    this.detailedProgressCallback = callback;
  }

  private emitProgress(status: string, progress: number): void {
    console.log(`[Sync] ${status} (${progress}%)`);
    if (this.progressCallback) {
      this.progressCallback(status, progress);
    }
  }

  private emitDetailedProgress(progress: DetailedSyncProgress): void {
    console.log(`[Sync] ${progress.phase}: ${progress.currentItem}/${progress.totalItems} ${progress.itemType}s (${progress.progress}%)`);
    if (this.detailedProgressCallback) {
      this.detailedProgressCallback(progress);
    }
  }

  private emitError(error: SyncError): void {
    console.error(`[Sync] Error: ${error.code} - ${error.message}`);
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  private async notifyStatusChange(): Promise<void> {
    if (this.statusCallback) {
      const state = await this.getSyncState();
      this.statusCallback(state);
    }
  }

  // ============================================
  // AUTO SYNC
  // ============================================

  /**
   * Start automatic background sync
   */
  startAutoSync(intervalMs: number = AUTO_SYNC_INTERVAL): void {
    this.stopAutoSync();

    this.autoSyncTimer = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        console.log("[Sync] Auto-sync triggered");
        await this.syncPendingChanges();
      }
    }, intervalMs);

    console.log(`[Sync] Auto-sync started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop automatic background sync
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log("[Sync] Auto-sync stopped");
    }
  }

  // ============================================
  // FULL SYNC
  // ============================================

  /**
   * Perform full bidirectional sync
   */
  async fullSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return this.createErrorResult("SYNC_IN_PROGRESS", "Sync already in progress");
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let downloaded = { checklists: 0, templates: 0, reports: 0 };
    let uploaded = { reports: 0, photos: 0, defects: 0, elements: 0 };

    try {
      this.emitProgress("Checking connection...", 5);

      // Check network status
      const isOnline = await checkApiHealth();
      if (!isOnline) {
        this.emitProgress("Offline - sync skipped", 100);
        return {
          success: true,
          downloaded,
          uploaded,
          errors: [],
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // Step 1: Upload local changes first (upload before download)
      this.emitProgress("Uploading local changes...", 10);
      const uploadResult = await this.uploadPendingChanges();
      uploaded = {
        reports: uploadResult.reportsSynced,
        photos: uploadResult.photosSynced,
        defects: 0, // Counted with reports
        elements: 0, // Counted with reports
      };
      errors.push(...uploadResult.errors);

      // Step 2: Download from server
      this.emitProgress("Downloading from server...", 50);
      const downloadResult = await this.downloadFromServer();
      downloaded = downloadResult.downloaded;
      errors.push(...downloadResult.errors);

      // Update last sync timestamp
      await updateDbSyncState({ lastUploadAt: new Date().toISOString() });
      await this.notifyStatusChange();

      this.emitProgress("Sync complete!", 100);

      const result: SyncResult = {
        success: errors.filter((e) => !e.retryable).length === 0,
        downloaded,
        uploaded,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // Emit sync complete callback
      if (this.syncCompleteCallback) {
        this.syncCompleteCallback(result);
      }

      return result;
    } catch (error) {
      const syncError: SyncError = {
        code: "FULL_SYNC_FAILED",
        message: error instanceof Error ? error.message : "Full sync failed",
        retryable: true,
      };
      errors.push(syncError);
      this.emitError(syncError);

      return {
        success: false,
        downloaded,
        uploaded,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isSyncing = false;
      await this.notifyStatusChange();
    }
  }

  // ============================================
  // UPLOAD SYNC (Mobile → Server)
  // ============================================

  /**
   * Sync pending local changes to server
   */
  async syncPendingChanges(): Promise<UploadResult> {
    if (this.isSyncing) {
      return { success: false, reportsSynced: 0, photosSynced: 0, errors: [], conflicts: 0 };
    }

    this.isSyncing = true;
    const errors: SyncError[] = [];
    let reportsSynced = 0;
    let photosSynced = 0;
    let conflicts = 0;

    try {
      // Check if online
      if (!this.isOnline) {
        const netState = await NetInfo.fetch();
        this.isOnline = netState.isConnected === true;
      }

      if (!this.isOnline) {
        console.log("[Sync] Offline - skipping upload");
        return { success: true, reportsSynced: 0, photosSynced: 0, errors: [], conflicts: 0 };
      }

      const result = await this.uploadPendingChanges();
      return result;
    } catch (error) {
      errors.push({
        code: "UPLOAD_FAILED",
        message: error instanceof Error ? error.message : "Upload failed",
        retryable: true,
      });
      return { success: false, reportsSynced, photosSynced, errors, conflicts };
    } finally {
      this.isSyncing = false;
      await this.notifyStatusChange();
    }
  }

  /**
   * Upload all pending changes to server
   */
  private async uploadPendingChanges(): Promise<UploadResult> {
    const errors: SyncError[] = [];
    let reportsSynced = 0;
    let photosSynced = 0;
    let conflicts = 0;

    try {
      // Get pending reports
      const pendingReports = await getPendingSyncReports();

      if (pendingReports.length === 0) {
        console.log("[Sync] No pending reports to upload");
        return { success: true, reportsSynced: 0, photosSynced: 0, errors: [], conflicts: 0 };
      }

      console.log(`[Sync] Found ${pendingReports.length} pending reports`);

      // Build sync payload
      const deviceId = await getOrCreateDeviceId();
      const reportsToSync: ReportSync[] = [];

      for (const report of pendingReports.slice(0, SYNC_BATCH_SIZE)) {
        try {
          const reportSync = await this.buildReportSyncPayload(report);
          if (reportSync) {
            reportsToSync.push(reportSync);
          }
        } catch (error) {
          console.error(`[Sync] Failed to build payload for report ${report.id}:`, error);
          errors.push({
            code: "PAYLOAD_BUILD_FAILED",
            message: error instanceof Error ? error.message : "Failed to build payload",
            entityType: "report",
            entityId: report.id,
            retryable: true,
          });
        }
      }

      if (reportsToSync.length === 0) {
        return { success: true, reportsSynced: 0, photosSynced: 0, errors, conflicts: 0 };
      }

      // Build upload payload
      const payload: SyncUploadPayload = {
        reports: reportsToSync,
        deviceId,
        syncTimestamp: new Date().toISOString(),
      };

      this.emitProgress(`Uploading ${reportsToSync.length} reports...`, 30);

      // Emit detailed progress for reports phase
      this.emitDetailedProgress({
        status: `Uploading ${reportsToSync.length} reports...`,
        progress: 30,
        phase: 'uploading_reports',
        currentItem: 0,
        totalItems: reportsToSync.length,
        itemType: 'report',
      });

      // Send to server
      const response = await this.sendUploadPayload(payload);

      if (!response.success) {
        errors.push({
          code: "UPLOAD_REQUEST_FAILED",
          message: "Server rejected upload",
          retryable: true,
        });
        return { success: false, reportsSynced: 0, photosSynced: 0, errors, conflicts: 0 };
      }

      // Process results
      reportsSynced = response.results.syncedReports.length;
      conflicts = response.stats.conflicts;

      // Update local sync status for successful reports
      let reportIndex = 0;
      for (const reportId of response.results.syncedReports) {
        reportIndex++;
        await this.markReportSynced(reportId);
        this.emitDetailedProgress({
          status: `Uploaded report ${reportIndex} of ${response.results.syncedReports.length}`,
          progress: 30 + Math.round((reportIndex / response.results.syncedReports.length) * 20),
          phase: 'uploading_reports',
          currentItem: reportIndex,
          totalItems: response.results.syncedReports.length,
          itemType: 'report',
        });
      }

      // Handle failed reports
      for (const failed of response.results.failedReports) {
        errors.push({
          code: "REPORT_SYNC_FAILED",
          message: failed.error,
          entityType: "report",
          entityId: failed.reportId,
          retryable: true,
        });
        await this.markReportSyncError(failed.reportId, failed.error);
      }

      // Upload photos that need binary upload
      if (response.results.pendingPhotoUploads.length > 0) {
        const totalPhotos = response.results.pendingPhotoUploads.length;
        this.emitProgress(`Uploading ${totalPhotos} photos...`, 60);
        this.emitDetailedProgress({
          status: `Uploading ${totalPhotos} photos...`,
          progress: 60,
          phase: 'uploading_photos',
          currentItem: 0,
          totalItems: totalPhotos,
          itemType: 'photo',
        });

        let photoIndex = 0;
        for (const photoUpload of response.results.pendingPhotoUploads) {
          photoIndex++;
          try {
            const uploaded = await this.uploadPhotoToPresignedUrl(
              photoUpload.photoId,
              photoUpload.uploadUrl
            );
            if (uploaded) {
              photosSynced++;
            }
            // Emit progress after each photo
            this.emitDetailedProgress({
              status: `Uploading photo ${photoIndex} of ${totalPhotos}`,
              progress: 60 + Math.round((photoIndex / totalPhotos) * 25),
              phase: 'uploading_photos',
              currentItem: photoIndex,
              totalItems: totalPhotos,
              itemType: 'photo',
            });
          } catch (error) {
            console.error(`[Sync] Failed to upload photo ${photoUpload.photoId}:`, error);
            errors.push({
              code: "PHOTO_UPLOAD_FAILED",
              message: error instanceof Error ? error.message : "Photo upload failed",
              entityType: "photo",
              entityId: photoUpload.photoId,
              retryable: true,
            });
          }
        }
      }

      // Log conflicts and notify
      if (response.results.conflicts.length > 0) {
        for (const conflict of response.results.conflicts) {
          console.log(
            `[Sync] Conflict resolved for report ${conflict.reportId}: ` +
              `${conflict.resolution} (server: ${conflict.serverUpdatedAt}, client: ${conflict.clientUpdatedAt})`
          );
        }
        // Emit conflict callback
        if (this.conflictCallback) {
          this.conflictCallback(response.results.conflicts);
        }
      }

      // Upload pending videos
      const pendingVideos = await getPendingUploadVideos();
      if (pendingVideos.length > 0) {
        const totalVideos = pendingVideos.length;
        this.emitProgress(`Uploading ${totalVideos} videos...`, 85);
        this.emitDetailedProgress({
          status: `Uploading ${totalVideos} videos...`,
          progress: 85,
          phase: 'uploading_videos',
          currentItem: 0,
          totalItems: totalVideos,
          itemType: 'video',
        });

        let videosSynced = 0;
        for (let i = 0; i < pendingVideos.length; i++) {
          const video = pendingVideos[i];
          const uploaded = await this.uploadVideo(video);
          if (uploaded) {
            videosSynced++;
          }
          this.emitDetailedProgress({
            status: `Uploading video ${i + 1} of ${totalVideos}`,
            progress: 85 + Math.round(((i + 1) / totalVideos) * 5),
            phase: 'uploading_videos',
            currentItem: i + 1,
            totalItems: totalVideos,
            itemType: 'video',
          });
        }
      }

      // Upload pending voice notes
      const pendingVoiceNotes = await getPendingUploadVoiceNotes();
      if (pendingVoiceNotes.length > 0) {
        const totalVoiceNotes = pendingVoiceNotes.length;
        this.emitProgress(`Uploading ${totalVoiceNotes} voice notes...`, 92);

        for (let i = 0; i < pendingVoiceNotes.length; i++) {
          const voiceNote = pendingVoiceNotes[i];
          await this.uploadVoiceNote(voiceNote);
        }
      }

      // Sync custody events to web server (non-blocking)
      // Required for court-admissible evidence trail
      this.emitProgress("Syncing custody events...", 94);
      const custodyResult = await this.syncCustodyEvents();
      if (custodyResult.synced > 0) {
        console.log(`[Sync] Synced ${custodyResult.synced} custody events`);
      }

      this.emitProgress("Upload complete", 95);
      this.emitDetailedProgress({
        status: "Upload complete",
        progress: 95,
        phase: 'complete',
        currentItem: reportsSynced + photosSynced,
        totalItems: reportsSynced + photosSynced,
        itemType: null,
      });

      return {
        success: errors.length === 0,
        reportsSynced,
        photosSynced,
        errors,
        conflicts,
      };
    } catch (error) {
      console.error("[Sync] Upload failed:", error);
      errors.push({
        code: "UPLOAD_FAILED",
        message: error instanceof Error ? error.message : "Upload failed",
        retryable: true,
      });
      return { success: false, reportsSynced, photosSynced, errors, conflicts };
    }
  }

  /**
   * Build sync payload for a single report with all nested data
   */
  private async buildReportSyncPayload(report: LocalReport): Promise<ReportSync | null> {
    // Get all related data
    const [elements, defects, photos, compliance] = await Promise.all([
      getRoofElementsForReport(report.id),
      getDefectsForReport(report.id),
      getPhotosForReport(report.id),
      getComplianceAssessment(report.id),
    ]);

    // Build element sync objects
    const elementSyncs: RoofElementSync[] = elements.map((e) => ({
      id: e.id,
      elementType: e.elementType,
      location: e.location,
      claddingType: e.claddingType,
      material: e.material,
      manufacturer: e.manufacturer,
      pitch: e.pitch,
      area: e.area,
      conditionRating: e.conditionRating,
      conditionNotes: e.conditionNotes,
      clientUpdatedAt: e.updatedAt,
    }));

    // Build defect sync objects
    const defectSyncs: DefectSync[] = defects.map((d) => ({
      id: d.id,
      defectNumber: d.defectNumber,
      title: d.title,
      description: d.description,
      location: d.location,
      classification: d.classification,
      severity: d.severity,
      observation: d.observation,
      analysis: d.analysis,
      opinion: d.opinion,
      codeReference: d.codeReference,
      copReference: d.copReference,
      recommendation: d.recommendation,
      priorityLevel: d.priorityLevel,
      roofElementId: d.roofElementId,
      clientUpdatedAt: d.updatedAt,
    }));

    // Build photo metadata sync objects
    const photoSyncs: PhotoMetadataSync[] = photos.map((p) => ({
      id: p.id,
      photoType: p.photoType,
      filename: p.filename,
      originalFilename: p.originalFilename,
      mimeType: p.mimeType,
      fileSize: p.fileSize,
      capturedAt: p.capturedAt,
      gpsLat: p.gpsLat,
      gpsLng: p.gpsLng,
      cameraMake: p.cameraMake,
      cameraModel: p.cameraModel,
      originalHash: p.originalHash,
      caption: p.caption,
      sortOrder: p.sortOrder,
      defectId: p.defectId,
      roofElementId: p.roofElementId,
      needsUpload: p.syncStatus === "captured" || p.syncStatus === "processing",
      clientUpdatedAt: p.createdAt,
    }));

    // Build compliance sync object
    let complianceSync: ComplianceAssessmentSync | null = null;
    if (compliance) {
      const checklistResults = JSON.parse(compliance.checklistResultsJson);
      complianceSync = {
        id: compliance.id,
        checklistResults,
        nonComplianceSummary: compliance.nonComplianceSummary,
        clientUpdatedAt: compliance.updatedAt,
      };
    }

    // Parse JSON fields
    const scopeOfWorks = report.scopeOfWorksJson ? JSON.parse(report.scopeOfWorksJson) : null;
    const methodology = report.methodologyJson ? JSON.parse(report.methodologyJson) : null;
    const findings = report.findingsJson ? JSON.parse(report.findingsJson) : null;
    const conclusions = report.conclusionsJson ? JSON.parse(report.conclusionsJson) : null;
    const recommendations = report.recommendationsJson ? JSON.parse(report.recommendationsJson) : null;

    // Build report sync object
    const reportSync: ReportSync = {
      id: report.id,
      reportNumber: report.reportNumber || `RANZ-${new Date().getFullYear()}-00000`, // Server will assign if new
      status: report.status,
      propertyAddress: report.propertyAddress,
      propertyCity: report.propertyCity,
      propertyRegion: report.propertyRegion,
      propertyPostcode: report.propertyPostcode,
      propertyType: report.propertyType,
      buildingAge: report.buildingAge,
      gpsLat: report.gpsLat,
      gpsLng: report.gpsLng,
      inspectionDate: report.inspectionDate,
      inspectionType: report.inspectionType,
      weatherConditions: report.weatherConditions,
      accessMethod: report.accessMethod,
      limitations: report.limitations,
      clientName: report.clientName,
      clientEmail: report.clientEmail,
      clientPhone: report.clientPhone,
      scopeOfWorks,
      methodology,
      findings,
      conclusions,
      recommendations,
      declarationSigned: report.declarationSigned,
      signedAt: report.signedAt,
      clientUpdatedAt: report.updatedAt,
      elements: elementSyncs,
      defects: defectSyncs,
      compliance: complianceSync,
      photoMetadata: photoSyncs,
    };

    return reportSync;
  }

  /**
   * Send upload payload to server
   */
  private async sendUploadPayload(payload: SyncUploadPayload): Promise<SyncUploadResponse> {
    try {
      const response = await withRetry(
        async () => {
          const result = await apiClient.post<SyncUploadResponse>("/api/sync/upload", payload);
          return result.data;
        },
        MAX_RETRY_ATTEMPTS,
        1000
      );

      return response;
    } catch (error) {
      console.error("[Sync] Failed to send upload payload:", error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
        stats: { total: 0, succeeded: 0, failed: payload.reports.length, conflicts: 0 },
        results: {
          syncedReports: [],
          failedReports: payload.reports.map((r) => ({
            reportId: r.id,
            error: error instanceof Error ? error.message : "Upload failed",
          })),
          conflicts: [],
          pendingPhotoUploads: [],
        },
      };
    }
  }

  /**
   * Upload photo binary to presigned URL
   */
  private async uploadPhotoToPresignedUrl(photoId: string, uploadUrl: string): Promise<boolean> {
    try {
      // Get photo from local database
      const photos = await getPendingUploadPhotos();
      const photo = photos.find((p) => p.id === photoId);

      if (!photo) {
        console.warn(`[Sync] Photo ${photoId} not found in pending uploads`);
        return false;
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(photo.localUri);
      if (!fileInfo.exists) {
        console.error(`[Sync] Photo file not found: ${photo.localUri}`);
        await updatePhotoSyncStatus(photoId, "error", undefined, "File not found");
        return false;
      }

      // Check WiFi-only setting for large files
      const syncSettings = await getSyncSettings();
      if (syncSettings.photosWifiOnly) {
        const fileSizeMb = photo.fileSize / (1024 * 1024);
        if (fileSizeMb >= syncSettings.wifiOnlyThresholdMb) {
          // Check current connection type
          const netState = await NetInfo.fetch();
          if (netState.type !== "wifi") {
            console.log(
              `[Sync] Photo ${photoId} (${fileSizeMb.toFixed(1)}MB) queued for WiFi upload`
            );
            // Keep as pending - will retry when on WiFi
            return false;
          }
        }
      }

      await updatePhotoSyncStatus(photoId, "processing");

      // Upload to presigned URL
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, photo.localUri, {
        httpMethod: "PUT",
        headers: {
          "Content-Type": photo.mimeType,
        },
        uploadType: FileSystemUploadType.BINARY_CONTENT,
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        // Extract the public URL (remove query params from presigned URL)
        const publicUrl = uploadUrl.split("?")[0];
        await updatePhotoSyncStatus(photoId, "synced", publicUrl);
        console.log(`[Sync] Photo ${photoId} uploaded successfully`);

        // Confirm upload with web server (non-blocking)
        // This updates the photo record with publicUrl and triggers thumbnail generation
        await this.confirmPhotoUpload(photoId, publicUrl);

        // Log chain of custody SYNCED event
        try {
          const { userId, userName } = await this.getCurrentUser();
          await logCustodySync(
            "photo",
            photoId,
            userId,
            userName,
            photo.originalHash || "",
            publicUrl
          );
          console.log(`[Sync] Logged SYNCED custody event for photo ${photoId}`);
        } catch (custodyError) {
          // Don't fail the upload if custody logging fails, just warn
          console.warn(`[Sync] Failed to log custody event for photo ${photoId}:`, custodyError);
        }

        // Verify evidence integrity after sync
        if (photo.originalHash) {
          try {
            // Use the original file URI (in originals/ directory)
            // Photos are stored with orig_ prefix in evidence/originals/
            const originalUri = photo.localUri.replace('/photos/', '/evidence/originals/orig_');
            const verification = await verifySyncedEvidence(
              'photo',
              photoId,
              photo.originalHash,
              originalUri
            );
            if (!verification.isValid) {
              console.error(`[Sync] Photo ${photoId} failed post-sync verification: ${verification.error}`);
              // Note: We don't fail the sync, but the verification is logged
            }
          } catch (verifyError) {
            console.warn(`[Sync] Could not verify photo ${photoId} after sync:`, verifyError);
          }
        }

        return true;
      } else {
        console.error(`[Sync] Photo upload failed with status ${uploadResult.status}`);
        await updatePhotoSyncStatus(photoId, "error", undefined, `Upload failed: ${uploadResult.status}`);
        return false;
      }
    } catch (error) {
      console.error(`[Sync] Photo upload error for ${photoId}:`, error);
      await updatePhotoSyncStatus(
        photoId,
        "error",
        undefined,
        error instanceof Error ? error.message : "Upload error"
      );
      return false;
    }
  }

  /**
   * Confirm photo upload with web server
   * Called after successful presigned URL upload to update server-side photo record
   * with public URL and trigger thumbnail generation
   * Non-blocking: failures are logged but don't stop sync
   */
  private async confirmPhotoUpload(photoId: string, publicUrl: string): Promise<boolean> {
    try {
      const response = await apiClient.post<{ success: boolean; thumbnailUrl?: string }>(
        `/api/photos/${photoId}/confirm-upload`,
        { publicUrl }
      );

      if (response.data.success) {
        console.log(`[Sync] Photo ${photoId} upload confirmed with server`);
        return true;
      } else {
        console.warn(`[Sync] Photo ${photoId} confirmation returned success=false`);
        return false;
      }
    } catch (error) {
      // Non-blocking: log error but don't fail the sync
      console.warn(
        `[Sync] Failed to confirm photo upload for ${photoId}:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  /**
   * Sync custody events to web server
   * Sends batched custody events for court-admissible evidence trail
   * Non-blocking: failures are logged but don't stop sync
   */
  private async syncCustodyEvents(): Promise<{ synced: number; failed: number }> {
    try {
      const unsyncedEvents = await getUnsyncedCustodyEvents();

      if (unsyncedEvents.length === 0) {
        console.log('[Sync] No custody events to sync');
        return { synced: 0, failed: 0 };
      }

      console.log(`[Sync] Syncing ${unsyncedEvents.length} custody events`);

      // Transform to server format
      const events = unsyncedEvents.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        userId: event.userId,
        userName: event.userName,
        details: event.details,
        createdAt: event.createdAt,
      }));

      const response = await apiClient.post<{
        success: boolean;
        processed: number;
        skipped: number;
      }>('/api/sync/custody-events', { events });

      if (response.data.success) {
        // Mark all events as synced
        const eventIds = unsyncedEvents.map((e) => e.id);
        await markCustodyEventsSynced(eventIds);

        console.log(
          `[Sync] Custody events synced: ${response.data.processed} processed, ${response.data.skipped} skipped`
        );
        return { synced: response.data.processed, failed: 0 };
      } else {
        console.warn('[Sync] Custody events sync returned success=false');
        return { synced: 0, failed: unsyncedEvents.length };
      }
    } catch (error) {
      // Non-blocking: log error but don't fail the sync
      console.warn(
        '[Sync] Failed to sync custody events:',
        error instanceof Error ? error.message : error
      );
      return { synced: 0, failed: 1 };
    }
  }

  /**
   * Upload video using chunked upload for large files
   */
  private async uploadVideo(video: LocalVideo): Promise<boolean> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(video.localUri);
      if (!fileInfo.exists) {
        console.error(`[Sync] Video file not found: ${video.localUri}`);
        await updateVideoSyncStatus(video.id, "error", undefined, "File not found");
        return false;
      }

      await updateVideoSyncStatus(video.id, "processing");

      const fileSize = (fileInfo as { size: number }).size;

      // Determine upload method based on file size
      if (shouldUseChunkedUpload(fileSize)) {
        // Use chunked upload for large files
        console.log(`[Sync] Using chunked upload for video ${video.id} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

        const result = await uploadWithResume({
          fileUri: video.localUri,
          endpoint: `${process.env.EXPO_PUBLIC_API_URL || ""}/api/upload/video`,
          metadata: {
            filename: video.filename,
            originalHash: video.originalHash || "",
            reportId: video.reportId,
            videoId: video.id,
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percent = Math.round((bytesUploaded / bytesTotal) * 100);
            console.log(`[Sync] Video ${video.id}: ${percent}% uploaded`);
          },
        });

        if (result.success && result.url) {
          await updateVideoSyncStatus(video.id, "synced", result.url);

          // Log chain of custody SYNCED event
          try {
            const { userId, userName } = await this.getCurrentUser();
            await logCustodySync(
              "video",
              video.id,
              userId,
              userName,
              video.originalHash || "",
              result.url
            );
            console.log(`[Sync] Logged SYNCED custody event for video ${video.id}`);
          } catch (custodyError) {
            console.warn(`[Sync] Failed to log custody event for video ${video.id}:`, custodyError);
          }

          // Verify evidence integrity after sync (for videos with originalHash)
          if (video.originalHash) {
            try {
              const verification = await verifySyncedEvidence(
                'video',
                video.id,
                video.originalHash,
                video.localUri
              );
              if (!verification.isValid) {
                console.error(`[Sync] Video ${video.id} failed post-sync verification: ${verification.error}`);
              }
            } catch (verifyError) {
              console.warn(`[Sync] Could not verify video ${video.id} after sync:`, verifyError);
            }
          }

          return true;
        } else {
          await updateVideoSyncStatus(video.id, "error", undefined, result.error || "Upload failed");
          return false;
        }
      } else {
        // Use direct upload for smaller files (existing pattern)
        // Request presigned URL from server
        const presignedResponse = await apiClient.post<{ uploadUrl: string; publicUrl: string }>(
          "/api/upload/video/presign",
          {
            videoId: video.id,
            filename: video.filename,
            mimeType: video.mimeType,
            fileSize,
            originalHash: video.originalHash,
            reportId: video.reportId,
          }
        );

        if (!presignedResponse.data.uploadUrl) {
          throw new Error("Failed to get presigned URL");
        }

        const uploadResult = await FileSystem.uploadAsync(
          presignedResponse.data.uploadUrl,
          video.localUri,
          {
            httpMethod: "PUT",
            headers: { "Content-Type": video.mimeType },
            uploadType: FileSystemUploadType.BINARY_CONTENT,
          }
        );

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          await updateVideoSyncStatus(video.id, "synced", presignedResponse.data.publicUrl);

          // Log chain of custody SYNCED event
          try {
            const { userId, userName } = await this.getCurrentUser();
            await logCustodySync(
              "video",
              video.id,
              userId,
              userName,
              video.originalHash || "",
              presignedResponse.data.publicUrl
            );
            console.log(`[Sync] Logged SYNCED custody event for video ${video.id}`);
          } catch (custodyError) {
            console.warn(`[Sync] Failed to log custody event for video ${video.id}:`, custodyError);
          }

          // Verify evidence integrity after sync (for videos with originalHash)
          if (video.originalHash) {
            try {
              const verification = await verifySyncedEvidence(
                'video',
                video.id,
                video.originalHash,
                video.localUri
              );
              if (!verification.isValid) {
                console.error(`[Sync] Video ${video.id} failed post-sync verification: ${verification.error}`);
              }
            } catch (verifyError) {
              console.warn(`[Sync] Could not verify video ${video.id} after sync:`, verifyError);
            }
          }

          return true;
        } else {
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        }
      }
    } catch (error) {
      console.error(`[Sync] Video upload failed for ${video.id}:`, error);
      await updateVideoSyncStatus(
        video.id,
        "error",
        undefined,
        error instanceof Error ? error.message : "Upload failed"
      );
      return false;
    }
  }

  /**
   * Upload voice note (direct upload - voice notes are small)
   */
  private async uploadVoiceNote(voiceNote: LocalVoiceNote): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(voiceNote.localUri);
      if (!fileInfo.exists) {
        console.error(`[Sync] Voice note file not found: ${voiceNote.localUri}`);
        await updateVoiceNoteSyncStatus(voiceNote.id, "error", undefined, "File not found");
        return false;
      }

      await updateVoiceNoteSyncStatus(voiceNote.id, "processing");

      const fileSize = (fileInfo as { size: number }).size;

      // Request presigned URL
      const presignedResponse = await apiClient.post<{ uploadUrl: string; publicUrl: string }>(
        "/api/upload/voice-note/presign",
        {
          voiceNoteId: voiceNote.id,
          filename: voiceNote.filename,
          mimeType: voiceNote.mimeType,
          fileSize,
          originalHash: voiceNote.originalHash,
          reportId: voiceNote.reportId,
        }
      );

      if (!presignedResponse.data.uploadUrl) {
        throw new Error("Failed to get presigned URL");
      }

      const uploadResult = await FileSystem.uploadAsync(
        presignedResponse.data.uploadUrl,
        voiceNote.localUri,
        {
          httpMethod: "PUT",
          headers: { "Content-Type": voiceNote.mimeType },
          uploadType: FileSystemUploadType.BINARY_CONTENT,
        }
      );

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        await updateVoiceNoteSyncStatus(voiceNote.id, "synced", presignedResponse.data.publicUrl);
        console.log(`[Sync] Voice note ${voiceNote.id} uploaded successfully`);

        // Log chain of custody SYNCED event
        try {
          const { userId, userName } = await this.getCurrentUser();
          await logCustodySync(
            "voice_note",
            voiceNote.id,
            userId,
            userName,
            voiceNote.originalHash || "",
            presignedResponse.data.publicUrl
          );
          console.log(`[Sync] Logged SYNCED custody event for voice note ${voiceNote.id}`);
        } catch (custodyError) {
          console.warn(`[Sync] Failed to log custody event for voice note ${voiceNote.id}:`, custodyError);
        }

        return true;
      } else {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }
    } catch (error) {
      console.error(`[Sync] Voice note upload failed for ${voiceNote.id}:`, error);
      await updateVoiceNoteSyncStatus(
        voiceNote.id,
        "error",
        undefined,
        error instanceof Error ? error.message : "Upload failed"
      );
      return false;
    }
  }

  /**
   * Mark report as synced in local database
   */
  private async markReportSynced(reportId: string): Promise<void> {
    const report = await getReport(reportId);
    if (report) {
      await saveReport({
        ...report,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
        lastSyncError: null,
      });
    }
  }

  /**
   * Mark report sync error in local database
   */
  private async markReportSyncError(reportId: string, error: string): Promise<void> {
    const report = await getReport(reportId);
    if (report) {
      await saveReport({
        ...report,
        syncStatus: "error",
        lastSyncError: error,
      });
    }
  }

  // ============================================
  // DOWNLOAD SYNC (Server → Mobile)
  // ============================================

  /**
   * Bootstrap - Full initial sync from server
   */
  async bootstrap(): Promise<SyncResult> {
    if (this.isSyncing) {
      return this.createErrorResult("SYNC_IN_PROGRESS", "Sync already in progress");
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // Clear stale sync queue items — the queue is not consumed;
      // sync happens through the report-bundle upload path instead.
      await clearSyncQueue();

      return await this.downloadFromServer();
    } finally {
      this.isSyncing = false;
      await this.notifyStatusChange();
    }
  }

  /**
   * Download data from server
   */
  private async downloadFromServer(): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let downloadedChecklists = 0;
    let downloadedTemplates = 0;
    let downloadedReports = 0;

    try {
      this.emitProgress("Checking connection...", 5);

      const isOnline = await checkApiHealth();
      if (!isOnline) {
        this.emitProgress("Offline - using cached data", 100);
        return {
          success: true,
          downloaded: { checklists: 0, templates: 0, reports: 0 },
          uploaded: { reports: 0, photos: 0, defects: 0, elements: 0 },
          errors: [],
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      this.emitProgress("Fetching data from server...", 10);

      const lastSyncAt = await getLastSyncAt();

      const response = await withRetry(
        () => fetchBootstrapData(lastSyncAt || undefined),
        MAX_RETRY_ATTEMPTS,
        1000
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch bootstrap data");
      }

      const data = response.data;

      // Save user data
      this.emitProgress("Saving user profile...", 20);
      try {
        await this.saveUserData(data.user);
      } catch (error) {
        errors.push({
          code: "USER_SAVE_FAILED",
          message: error instanceof Error ? error.message : "Failed to save user",
          retryable: true,
        });
      }

      // Download checklists
      this.emitProgress("Downloading checklists...", 35);
      try {
        downloadedChecklists = await this.downloadChecklists(data.checklists);
      } catch (error) {
        errors.push({
          code: "CHECKLIST_DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to download checklists",
          retryable: true,
        });
      }

      // Download templates
      this.emitProgress("Downloading templates...", 55);
      try {
        downloadedTemplates = await this.downloadTemplates(data.templates);
      } catch (error) {
        errors.push({
          code: "TEMPLATE_DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to download templates",
          retryable: true,
        });
      }

      // Download recent reports
      this.emitProgress("Syncing recent reports...", 75);
      try {
        downloadedReports = await this.downloadRecentReports(data.recentReports);
      } catch (error) {
        errors.push({
          code: "REPORT_DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to download reports",
          retryable: true,
        });
      }

      // Save sync timestamp
      this.emitProgress("Finalizing sync...", 95);
      await saveLastSyncAt(data.lastSyncAt);
      await updateDbSyncState({ lastBootstrapAt: new Date().toISOString() });

      this.emitProgress("Download complete!", 100);

      return {
        success: errors.length === 0,
        downloaded: {
          checklists: downloadedChecklists,
          templates: downloadedTemplates,
          reports: downloadedReports,
        },
        uploaded: { reports: 0, photos: 0, defects: 0, elements: 0 },
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const syncError: SyncError = {
        code: "DOWNLOAD_FAILED",
        message: error instanceof Error ? error.message : "Download failed",
        retryable: true,
      };
      errors.push(syncError);
      this.emitError(syncError);

      return {
        success: false,
        downloaded: {
          checklists: downloadedChecklists,
          templates: downloadedTemplates,
          reports: downloadedReports,
        },
        uploaded: { reports: 0, photos: 0, defects: 0, elements: 0 },
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async saveUserData(user: User): Promise<void> {
    const localUser: LocalUser = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status ?? "ACTIVE",
      company: user.company ?? null,
      qualifications: user.qualifications ?? null,
      lbpNumber: user.lbpNumber ?? null,
      yearsExperience: user.yearsExperience ?? null,
      syncedAt: new Date().toISOString(),
    };
    await saveUser(localUser);
  }

  async downloadChecklists(checklists: Checklist[]): Promise<number> {
    let count = 0;

    for (const checklist of checklists) {
      try {
        if (!checklist.id || !checklist.name) {
          console.warn(`[Sync] Invalid checklist structure: ${checklist.id}`);
          continue;
        }

        const localChecklist: LocalChecklist = {
          id: checklist.id,
          name: checklist.name,
          category: checklist.category,
          standard: checklist.standard ?? null,
          itemsJson: JSON.stringify(checklist.items || []),
          downloadedAt: new Date().toISOString(),
          updatedAt: checklist.updatedAt || new Date().toISOString(),
        };

        await saveChecklist(localChecklist);
        count++;
      } catch (error) {
        console.error(`[Sync] Failed to save checklist ${checklist.id}:`, error);
      }
    }

    console.log(`[Sync] Downloaded ${count} checklists`);
    return count;
  }

  async downloadTemplates(templates: ReportTemplate[]): Promise<number> {
    let count = 0;

    for (const template of templates) {
      try {
        if (!template.id || !template.name) {
          console.warn(`[Sync] Invalid template structure: ${template.id}`);
          continue;
        }

        const localTemplate: LocalTemplate = {
          id: template.id,
          name: template.name,
          description: template.description,
          inspectionType: template.inspectionType,
          sectionsJson: JSON.stringify(template.sections),
          checklistsJson: template.checklists ? JSON.stringify(template.checklists) : null,
          isDefault: template.isDefault,
          downloadedAt: new Date().toISOString(),
        };

        await saveTemplate(localTemplate);
        count++;
      } catch (error) {
        console.error(`[Sync] Failed to save template ${template.id}:`, error);
      }
    }

    console.log(`[Sync] Downloaded ${count} templates`);
    return count;
  }

  async downloadRecentReports(reports: ReportSummary[]): Promise<number> {
    let count = 0;

    for (const report of reports) {
      try {
        const existingReports = await getAllReports();
        const existingReport = existingReports.find(
          (r) => r.id === report.id || r.reportNumber === report.reportNumber
        );

        if (existingReport) {
          // Skip if local has unsynced changes
          if (
            existingReport.syncStatus !== "synced" &&
            new Date(existingReport.updatedAt) > new Date(report.updatedAt)
          ) {
            console.log(`[Sync] Skipping report ${report.id} - local changes are newer`);
            continue;
          }
        }

        const localReport: LocalReport = {
          id: existingReport?.id || report.id,
          reportNumber: report.reportNumber,
          status: report.status,
          propertyAddress: report.propertyAddress,
          propertyCity: report.propertyCity,
          propertyRegion: existingReport?.propertyRegion || "",
          propertyPostcode: existingReport?.propertyPostcode || "",
          propertyType: existingReport?.propertyType || ("RESIDENTIAL_1" as LocalReport["propertyType"]),
          buildingAge: existingReport?.buildingAge || null,
          gpsLat: existingReport?.gpsLat || null,
          gpsLng: existingReport?.gpsLng || null,
          inspectionDate: report.createdAt,
          inspectionType: report.inspectionType,
          weatherConditions: existingReport?.weatherConditions || null,
          accessMethod: existingReport?.accessMethod || null,
          limitations: existingReport?.limitations || null,
          clientName: existingReport?.clientName || "",
          clientEmail: existingReport?.clientEmail || null,
          clientPhone: existingReport?.clientPhone || null,
          scopeOfWorksJson: existingReport?.scopeOfWorksJson || null,
          methodologyJson: existingReport?.methodologyJson || null,
          findingsJson: existingReport?.findingsJson || null,
          conclusionsJson: existingReport?.conclusionsJson || null,
          recommendationsJson: existingReport?.recommendationsJson || null,
          declarationSigned: existingReport?.declarationSigned || false,
          signedAt: existingReport?.signedAt || null,
          inspectorId: report.inspectorId ?? existingReport?.inspectorId ?? null,
          submittedAt: report.submittedAt ?? existingReport?.submittedAt ?? null,
          approvedAt: report.approvedAt ?? existingReport?.approvedAt ?? null,
          syncStatus: "synced",
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          syncedAt: new Date().toISOString(),
          lastSyncError: null,
        };

        await saveReport(localReport);
        count++;
      } catch (error) {
        console.error(`[Sync] Failed to save report ${report.id}:`, error);
      }
    }

    console.log(`[Sync] Downloaded ${count} report summaries`);
    return count;
  }

  // ============================================
  // STATE & UTILITIES
  // ============================================

  async getSyncState(): Promise<SyncState> {
    const [pendingSync, lastSyncAt, isOnline] = await Promise.all([
      getSyncQueueCount(),
      getLastSyncAt(),
      checkApiHealth().catch(() => false),
    ]);

    const pendingReports = await getPendingSyncReports();

    return {
      isOnline,
      isSyncing: this.isSyncing,
      lastSyncAt,
      pendingUploads: pendingReports.length,
      pendingDownloads: 0,
      lastError: null,
    };
  }

  async getLocalChecklist(standard: string): Promise<Checklist | null> {
    const checklists = await getAllChecklists();
    const local = checklists.find((c) => c.standard === standard);

    if (!local) return null;

    try {
      const items = JSON.parse(local.itemsJson);
      return {
        id: local.id,
        name: local.name,
        category: local.category,
        standard: local.standard,
        items: items || [],
        createdAt: local.downloadedAt,
        updatedAt: local.updatedAt,
      };
    } catch {
      return null;
    }
  }

  async getLocalTemplate(inspectionType: string): Promise<ReportTemplate | null> {
    const templates = await getAllTemplates();
    const local = templates.find((t) => t.inspectionType === inspectionType);

    if (!local) return null;

    return {
      id: local.id,
      name: local.name,
      description: local.description,
      inspectionType: local.inspectionType as ReportTemplate["inspectionType"],
      sections: JSON.parse(local.sectionsJson),
      checklists: local.checklistsJson ? JSON.parse(local.checklistsJson) : null,
      isDefault: local.isDefault,
      isActive: true,
      createdAt: local.downloadedAt,
      updatedAt: local.downloadedAt,
    };
  }

  private createErrorResult(code: string, message: string): SyncResult {
    return {
      success: false,
      downloaded: { checklists: 0, templates: 0, reports: 0 },
      uploaded: { reports: 0, photos: 0, defects: 0, elements: 0 },
      errors: [{ code, message, retryable: false }],
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Force retry all failed syncs
   */
  async retryFailedSyncs(): Promise<SyncResult> {
    // Reset error status on failed reports
    const allReports = await getAllReports();
    for (const report of allReports) {
      if (report.syncStatus === "error") {
        await saveReport({
          ...report,
          syncStatus: "pending",
          lastSyncError: null,
        });
      }
    }

    // Reset failed photo syncs
    const pendingPhotos = await getPendingUploadPhotos();
    for (const photo of pendingPhotos) {
      if (photo.syncStatus === "error") {
        await updatePhotoSyncStatus(photo.id, "captured");
      }
    }

    // Run full sync
    return this.fullSync();
  }
}

// ============================================
// SINGLETON & EXPORTS
// ============================================

export const syncEngine = new SyncEngine();

export async function initializeSyncEngine(): Promise<SyncResult> {
  return syncEngine.bootstrap();
}

export async function fullSync(): Promise<SyncResult> {
  return syncEngine.fullSync();
}

export async function syncPendingChanges(): Promise<UploadResult> {
  return syncEngine.syncPendingChanges();
}

export async function getSyncState(): Promise<SyncState> {
  return syncEngine.getSyncState();
}

export async function getLocalChecklist(standard: string): Promise<Checklist | null> {
  return syncEngine.getLocalChecklist(standard);
}

export async function getLocalTemplate(inspectionType: string): Promise<ReportTemplate | null> {
  return syncEngine.getLocalTemplate(inspectionType);
}

export function startAutoSync(intervalMs?: number): void {
  syncEngine.startAutoSync(intervalMs);
}

export function stopAutoSync(): void {
  syncEngine.stopAutoSync();
}

export async function retryFailedSyncs(): Promise<SyncResult> {
  return syncEngine.retryFailedSyncs();
}

export function onSyncProgress(callback: ProgressCallback): void {
  syncEngine.onProgress(callback);
}

export function onSyncError(callback: ErrorCallback): void {
  syncEngine.onError(callback);
}

export function onSyncStatusChange(callback: StatusCallback): void {
  syncEngine.onStatusChange(callback);
}

export function onSyncConflict(callback: ConflictCallback): void {
  syncEngine.onConflict(callback);
}

export function onSyncComplete(callback: SyncCompleteCallback): void {
  syncEngine.onSyncComplete(callback);
}

export function onDetailedProgress(callback: DetailedProgressCallback): void {
  syncEngine.onDetailedProgress(callback);
}
