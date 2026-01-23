/**
 * Review Service
 * Handles review workflow operations and API calls
 */

import {
  getReport,
  updateReportStatus,
  getReportsPendingReview,
  addToSyncQueue,
} from "../lib/sqlite";
import type { LocalReport } from "../types/database";
import type { ReportStatus } from "../types/shared";
import type { ReviewStats } from "../stores/review-store";

// ============================================
// TYPES
// ============================================

export interface SubmitForReviewResult {
  success: boolean;
  error?: string;
}

export interface ReviewActionResult {
  success: boolean;
  report?: LocalReport;
  error?: string;
}

export interface ReviewActionPayload {
  action: "APPROVE" | "REJECT" | "REQUEST_REVISION";
  note?: string;
  revisionItems?: string[]; // Specific items needing revision
}

// ============================================
// REVIEW SERVICE
// ============================================

class ReviewService {
  /**
   * Submit a report for review (Inspector action)
   */
  async submitForReview(reportId: string): Promise<SubmitForReviewResult> {
    try {
      // Get the report
      const report = await getReport(reportId);
      if (!report) {
        return { success: false, error: "Report not found" };
      }

      // Validate report is ready for submission
      const validation = this.validateForSubmission(report);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Update local status
      const timestamp = new Date().toISOString();
      await updateReportStatus(reportId, "PENDING_REVIEW", timestamp);

      // Add to sync queue for server update
      await addToSyncQueue("report", reportId, "submit_for_review", {
        reportId,
        submittedAt: timestamp,
      });

      console.log("[ReviewService] Report submitted for review:", reportId);
      return { success: true };
    } catch (error) {
      console.error("[ReviewService] Failed to submit for review:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit",
      };
    }
  }

  /**
   * Validate a report is ready for submission
   */
  private validateForSubmission(report: LocalReport): { valid: boolean; error?: string } {
    // Must be in draft or in_progress status
    if (report.status !== "DRAFT" && report.status !== "IN_PROGRESS") {
      return { valid: false, error: "Report has already been submitted" };
    }

    // Must have basic required fields
    if (!report.propertyAddress) {
      return { valid: false, error: "Property address is required" };
    }

    if (!report.clientName) {
      return { valid: false, error: "Client name is required" };
    }

    if (!report.inspectionDate) {
      return { valid: false, error: "Inspection date is required" };
    }

    // Declaration must be signed
    if (!report.declarationSigned) {
      return { valid: false, error: "Declaration must be signed before submission" };
    }

    return { valid: true };
  }

  /**
   * Approve a report (Reviewer action)
   */
  async approveReport(
    reportId: string,
    reviewerId: string,
    note?: string
  ): Promise<ReviewActionResult> {
    try {
      const timestamp = new Date().toISOString();

      // Update local status
      await updateReportStatus(reportId, "APPROVED", timestamp);

      // Add to sync queue
      await addToSyncQueue("report", reportId, "review_action", {
        action: "APPROVE",
        reviewerId,
        note,
        approvedAt: timestamp,
      });

      // Get updated report
      const report = await getReport(reportId);

      console.log("[ReviewService] Report approved:", reportId);
      return { success: true, report: report || undefined };
    } catch (error) {
      console.error("[ReviewService] Failed to approve report:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve",
      };
    }
  }

  /**
   * Reject a report (Reviewer action)
   */
  async rejectReport(
    reportId: string,
    reviewerId: string,
    note: string
  ): Promise<ReviewActionResult> {
    try {
      if (!note || note.trim().length === 0) {
        return { success: false, error: "Rejection reason is required" };
      }

      const timestamp = new Date().toISOString();

      // Update local status back to draft
      await updateReportStatus(reportId, "DRAFT", null);

      // Add to sync queue
      await addToSyncQueue("report", reportId, "review_action", {
        action: "REJECT",
        reviewerId,
        note,
        rejectedAt: timestamp,
      });

      const report = await getReport(reportId);

      console.log("[ReviewService] Report rejected:", reportId);
      return { success: true, report: report || undefined };
    } catch (error) {
      console.error("[ReviewService] Failed to reject report:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject",
      };
    }
  }

  /**
   * Request revisions for a report (Reviewer action)
   */
  async requestRevision(
    reportId: string,
    reviewerId: string,
    note: string,
    revisionItems?: string[]
  ): Promise<ReviewActionResult> {
    try {
      if (!note || note.trim().length === 0) {
        return { success: false, error: "Revision details are required" };
      }

      const timestamp = new Date().toISOString();

      // Update local status back to in_progress
      await updateReportStatus(reportId, "IN_PROGRESS", null);

      // Add to sync queue
      await addToSyncQueue("report", reportId, "review_action", {
        action: "REQUEST_REVISION",
        reviewerId,
        note,
        revisionItems,
        requestedAt: timestamp,
      });

      const report = await getReport(reportId);

      console.log("[ReviewService] Revision requested:", reportId);
      return { success: true, report: report || undefined };
    } catch (error) {
      console.error("[ReviewService] Failed to request revision:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to request revision",
      };
    }
  }

  /**
   * Finalise an approved report (Admin/Reviewer action)
   */
  async finaliseReport(reportId: string): Promise<ReviewActionResult> {
    try {
      const report = await getReport(reportId);
      if (!report) {
        return { success: false, error: "Report not found" };
      }

      if (report.status !== "APPROVED") {
        return { success: false, error: "Report must be approved before finalising" };
      }

      const timestamp = new Date().toISOString();

      // Update local status
      await updateReportStatus(reportId, "FINALISED", timestamp);

      // Add to sync queue
      await addToSyncQueue("report", reportId, "finalise", {
        finalisedAt: timestamp,
      });

      const updatedReport = await getReport(reportId);

      console.log("[ReviewService] Report finalised:", reportId);
      return { success: true, report: updatedReport || undefined };
    } catch (error) {
      console.error("[ReviewService] Failed to finalise report:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to finalise",
      };
    }
  }

  /**
   * Get reports pending review
   */
  async getPendingReviewReports(): Promise<LocalReport[]> {
    try {
      const reports = await getReportsPendingReview();
      return reports;
    } catch (error) {
      console.error("[ReviewService] Failed to get pending reports:", error);
      return [];
    }
  }

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ReviewStats> {
    try {
      const pendingReports = await getReportsPendingReview();
      const today = new Date().toISOString().split("T")[0];

      // These would come from the server in a real implementation
      // For now, return basic local stats
      return {
        pendingCount: pendingReports.length,
        approvedToday: 0, // Would need server data
        rejectedToday: 0, // Would need server data
        avgReviewTime: 0, // Would need server data
      };
    } catch (error) {
      console.error("[ReviewService] Failed to get stats:", error);
      return {
        pendingCount: 0,
        approvedToday: 0,
        rejectedToday: 0,
        avgReviewTime: 0,
      };
    }
  }

  /**
   * Bulk approve reports
   */
  async bulkApprove(
    reportIds: string[],
    reviewerId: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const reportId of reportIds) {
      const result = await this.approveReport(reportId, reviewerId);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${reportId}: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Get report status display info
   */
  getStatusDisplayInfo(status: ReportStatus): {
    label: string;
    color: string;
    bgColor: string;
  } {
    switch (status) {
      case "DRAFT":
        return { label: "Draft", color: "#6b7280", bgColor: "#f3f4f6" };
      case "IN_PROGRESS":
        return { label: "In Progress", color: "#2563eb", bgColor: "#dbeafe" };
      case "PENDING_REVIEW":
        return { label: "Pending Review", color: "#d97706", bgColor: "#fef3c7" };
      case "APPROVED":
        return { label: "Approved", color: "#059669", bgColor: "#d1fae5" };
      case "FINALISED":
        return { label: "Finalised", color: "#7c3aed", bgColor: "#ede9fe" };
      default:
        return { label: status, color: "#6b7280", bgColor: "#f3f4f6" };
    }
  }
}

// Export singleton instance
export const reviewService = new ReviewService();
