/**
 * Review Store
 * Zustand store for managing review workflow state
 */

import { create } from "zustand";
import type { Report, ReportStatus, UserRole } from "../types/shared";

// ============================================
// TYPES
// ============================================

export interface ReviewNote {
  id: string;
  reportId: string;
  reviewerId: string;
  reviewerName: string;
  action: ReviewAction;
  note: string;
  createdAt: string;
}

export type ReviewAction =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "REVISION_SUBMITTED"
  | "FINALISED";

export interface ReviewFilter {
  status: ReportStatus | "ALL";
  inspectorId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  searchQuery: string;
}

export interface ReviewStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  avgReviewTime: number; // in hours
}

interface ReviewState {
  // Review queue
  reviewQueue: Report[];
  isLoadingQueue: boolean;
  queueError: string | null;

  // Current review
  currentReport: Report | null;
  reviewNotes: ReviewNote[];
  isSubmitting: boolean;

  // Filters
  filter: ReviewFilter;

  // Stats
  stats: ReviewStats;

  // Selected reports for bulk actions
  selectedReportIds: string[];

  // Actions
  setReviewQueue: (reports: Report[]) => void;
  setIsLoadingQueue: (loading: boolean) => void;
  setQueueError: (error: string | null) => void;
  setCurrentReport: (report: Report | null) => void;
  setReviewNotes: (notes: ReviewNote[]) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setFilter: (filter: Partial<ReviewFilter>) => void;
  resetFilter: () => void;
  setStats: (stats: ReviewStats) => void;
  toggleReportSelection: (reportId: string) => void;
  selectAllReports: (reportIds: string[]) => void;
  clearSelection: () => void;

  // Computed
  getFilteredQueue: () => Report[];
}

// ============================================
// DEFAULT VALUES
// ============================================

const defaultFilter: ReviewFilter = {
  status: "ALL",
  inspectorId: null,
  dateFrom: null,
  dateTo: null,
  searchQuery: "",
};

const defaultStats: ReviewStats = {
  pendingCount: 0,
  approvedToday: 0,
  rejectedToday: 0,
  avgReviewTime: 0,
};

// ============================================
// STORE
// ============================================

export const useReviewStore = create<ReviewState>((set, get) => ({
  // Initial state
  reviewQueue: [],
  isLoadingQueue: false,
  queueError: null,
  currentReport: null,
  reviewNotes: [],
  isSubmitting: false,
  filter: defaultFilter,
  stats: defaultStats,
  selectedReportIds: [],

  // Actions
  setReviewQueue: (reports) => set({ reviewQueue: reports }),
  setIsLoadingQueue: (loading) => set({ isLoadingQueue: loading }),
  setQueueError: (error) => set({ queueError: error }),
  setCurrentReport: (report) => set({ currentReport: report }),
  setReviewNotes: (notes) => set({ reviewNotes: notes }),
  setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),

  setFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),

  resetFilter: () => set({ filter: defaultFilter }),

  setStats: (stats) => set({ stats }),

  toggleReportSelection: (reportId) =>
    set((state) => {
      const isSelected = state.selectedReportIds.includes(reportId);
      return {
        selectedReportIds: isSelected
          ? state.selectedReportIds.filter((id) => id !== reportId)
          : [...state.selectedReportIds, reportId],
      };
    }),

  selectAllReports: (reportIds) => set({ selectedReportIds: reportIds }),

  clearSelection: () => set({ selectedReportIds: [] }),

  // Computed
  getFilteredQueue: () => {
    const { reviewQueue, filter } = get();

    return reviewQueue.filter((report) => {
      // Status filter
      if (filter.status !== "ALL" && report.status !== filter.status) {
        return false;
      }

      // Inspector filter
      if (filter.inspectorId && report.inspectorId !== filter.inspectorId) {
        return false;
      }

      // Date range filter
      if (filter.dateFrom) {
        const reportDate = new Date(report.inspectionDate);
        const fromDate = new Date(filter.dateFrom);
        if (reportDate < fromDate) return false;
      }

      if (filter.dateTo) {
        const reportDate = new Date(report.inspectionDate);
        const toDate = new Date(filter.dateTo);
        if (reportDate > toDate) return false;
      }

      // Search query
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const matchesAddress = report.propertyAddress?.toLowerCase().includes(query);
        const matchesClient = report.clientName?.toLowerCase().includes(query);
        const matchesNumber = report.reportNumber?.toLowerCase().includes(query);
        if (!matchesAddress && !matchesClient && !matchesNumber) {
          return false;
        }
      }

      return true;
    });
  },
}));

// ============================================
// SELECTORS (for optimized renders)
// ============================================

export const selectPendingCount = (state: ReviewState) =>
  state.reviewQueue.filter(r => r.status === "PENDING_REVIEW").length;

export const selectIsAnySelected = (state: ReviewState) =>
  state.selectedReportIds.length > 0;

export const selectSelectedCount = (state: ReviewState) =>
  state.selectedReportIds.length;
