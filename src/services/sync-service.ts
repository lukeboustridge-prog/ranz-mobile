/**
 * Sync Service
 * Handles offline sync engine for down-sync (server → mobile) and up-sync (mobile → server)
 */

import { fetchBootstrapData, withRetry, checkApiHealth } from "../lib/api";
import {
  saveUser,
  getUser,
  saveChecklist,
  getAllChecklists,
  saveTemplate,
  getAllTemplates,
  saveReportDraft,
  getAllReportDrafts,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueAttempt,
  getSyncQueueCount,
} from "../lib/sqlite";
import { saveLastSyncAt, getLastSyncAt } from "../lib/storage";
import type { LocalUser, LocalChecklist, LocalTemplate, LocalReportDraft } from "../types/database";
import type {
  SyncProgress,
  SyncResult,
  SyncError,
  BootstrapData,
  SyncState,
  NetworkStatus,
} from "../types/sync";
import type { Checklist, ReportTemplate, ReportSummary, User } from "../types/shared";

// ============================================
// SYNC ENGINE CLASS
// ============================================

type ProgressCallback = (status: string, progress: number) => void;
type ErrorCallback = (error: SyncError) => void;

class SyncEngine {
  private progressCallback: ProgressCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private isSyncing: boolean = false;

  /**
   * Register progress callback
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Emit progress update
   */
  private emitProgress(status: string, progress: number): void {
    if (this.progressCallback) {
      this.progressCallback(status, progress);
    }
  }

  /**
   * Emit error
   */
  private emitError(error: SyncError): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  /**
   * Bootstrap - Full initial sync from server
   */
  async bootstrap(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        downloaded: { checklists: 0, templates: 0, reports: 0 },
        uploaded: { reports: 0, photos: 0, defects: 0, elements: 0 },
        errors: [{ code: "SYNC_IN_PROGRESS", message: "Sync already in progress", retryable: false }],
        duration: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let downloadedChecklists = 0;
    let downloadedTemplates = 0;
    let downloadedReports = 0;

    try {
      this.emitProgress("Checking connection...", 5);

      // Check API health
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

      // Get last sync timestamp for incremental sync
      const lastSyncAt = await getLastSyncAt();

      // Fetch bootstrap data with retry
      const response = await withRetry(
        () => fetchBootstrapData(lastSyncAt || undefined),
        3,
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

      // Download and save checklists
      this.emitProgress("Downloading checklists...", 35);
      try {
        downloadedChecklists = await this.downloadChecklists(data.checklists);
      } catch (error) {
        errors.push({
          code: "CHECKLIST_DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to download checklists",
          retryable: true,
        });
        this.emitError({
          code: "CHECKLIST_DOWNLOAD_FAILED",
          message: "Failed to download checklists",
          retryable: true,
        });
      }

      // Download and save templates
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

      // Save last sync timestamp
      this.emitProgress("Finalizing sync...", 95);
      await saveLastSyncAt(data.lastSyncAt);

      this.emitProgress("Sync complete!", 100);

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
        code: "BOOTSTRAP_FAILED",
        message: error instanceof Error ? error.message : "Bootstrap failed",
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
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Save user data to local database
   */
  private async saveUserData(user: User): Promise<void> {
    const localUser: LocalUser = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
      qualifications: user.qualifications,
      lbpNumber: user.lbpNumber,
      syncedAt: new Date().toISOString(),
    };
    await saveUser(localUser);
  }

  /**
   * Download and save checklists
   */
  async downloadChecklists(checklists: Checklist[]): Promise<number> {
    let count = 0;

    for (const checklist of checklists) {
      try {
        // Validate checklist structure
        if (!checklist.id || !checklist.name) {
          console.warn(`[Sync] Invalid checklist structure: ${checklist.id}`);
          continue;
        }

        const localChecklist: LocalChecklist = {
          id: checklist.id,
          name: checklist.name,
          version: checklist.version || "1.0",
          category: checklist.category,
          standard: checklist.standard,
          definition: JSON.stringify(checklist),
          downloadedAt: new Date().toISOString(),
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

  /**
   * Download and save templates
   */
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

  /**
   * Download recent reports (summaries only)
   */
  async downloadRecentReports(reports: ReportSummary[]): Promise<number> {
    let count = 0;

    for (const report of reports) {
      try {
        // Check if we already have this report locally
        const existingDrafts = await getAllReportDrafts();
        const existingDraft = existingDrafts.find(
          (d) => d.reportId === report.id || d.reportNumber === report.reportNumber
        );

        if (existingDraft) {
          // Conflict detection: if local is newer and has changes, skip
          if (
            existingDraft.syncStatus !== "synced" &&
            new Date(existingDraft.updatedAt) > new Date(report.updatedAt)
          ) {
            console.log(`[Sync] Skipping report ${report.id} - local changes are newer`);
            continue;
          }
        }

        // Create minimal draft entry from summary
        const localDraft: LocalReportDraft = {
          id: existingDraft?.id || `local_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          reportId: report.id,
          reportNumber: report.reportNumber,
          propertyAddress: report.propertyAddress,
          propertyCity: report.propertyCity,
          propertyRegion: "",
          propertyPostcode: "",
          propertyType: "RESIDENTIAL_1" as LocalReportDraft["propertyType"],
          buildingAge: null,
          clientName: "",
          clientEmail: null,
          clientPhone: null,
          inspectionDate: report.createdAt,
          inspectionType: report.inspectionType,
          weatherConditions: null,
          accessMethod: null,
          limitations: null,
          executiveSummary: null,
          conclusions: null,
          status: report.status,
          syncStatus: "synced",
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          syncedAt: new Date().toISOString(),
          lastSyncError: null,
        };

        await saveReportDraft(localDraft);
        count++;
      } catch (error) {
        console.error(`[Sync] Failed to save report ${report.id}:`, error);
      }
    }

    console.log(`[Sync] Downloaded ${count} report summaries`);
    return count;
  }

  /**
   * Get locally cached checklist by standard
   */
  async getLocalChecklist(standard: string): Promise<Checklist | null> {
    const checklists = await getAllChecklists();
    const local = checklists.find((c) => c.standard === standard);

    if (!local) return null;

    try {
      // Parse the full checklist definition
      const parsed = JSON.parse(local.definition);
      return {
        id: local.id,
        name: local.name,
        version: local.version,
        category: local.category,
        standard: local.standard,
        sections: parsed.sections || [],
        items: parsed.items || [],
        createdAt: local.downloadedAt,
        updatedAt: local.downloadedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get locally cached template by inspection type
   */
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

  /**
   * Get current sync state
   */
  async getSyncState(): Promise<SyncState> {
    const [pendingSync, lastSyncAt, isOnline] = await Promise.all([
      getSyncQueueCount(),
      getLastSyncAt(),
      checkApiHealth(),
    ]);

    return {
      isOnline,
      isSyncing: this.isSyncing,
      lastSyncAt,
      pendingUploads: pendingSync,
      pendingDownloads: 0,
      lastError: null,
    };
  }

  /**
   * Process upload queue
   */
  async processUploadQueue(): Promise<{ uploaded: number; failed: number }> {
    const queue = await getSyncQueue();
    let uploaded = 0;
    let failed = 0;

    for (const item of queue) {
      if (item.attemptCount >= 3) {
        console.log(`[Sync] Skipping item ${item.id} - max attempts reached`);
        failed++;
        continue;
      }

      try {
        // Process based on entity type
        // TODO: Implement actual upload logic for each entity type
        console.log(`[Sync] Would upload ${item.entityType} ${item.entityId}`);

        // Remove from queue on success
        await removeSyncQueueItem(item.id);
        uploaded++;
      } catch (error) {
        await updateSyncQueueAttempt(
          item.id,
          error instanceof Error ? error.message : "Unknown error"
        );
        failed++;
      }
    }

    return { uploaded, failed };
  }
}

// Export singleton instance
export const syncEngine = new SyncEngine();

// Export convenience functions
export async function initializeSyncEngine(): Promise<SyncResult> {
  return syncEngine.bootstrap();
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
