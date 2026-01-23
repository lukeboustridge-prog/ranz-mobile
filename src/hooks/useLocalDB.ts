/**
 * useLocalDB Hook
 * Provides access to local SQLite database operations
 */

import { useState, useEffect, useCallback } from "react";
import {
  getAllReportDrafts,
  getReportDraft,
  saveReportDraft,
  getAllChecklists,
  getAllTemplates,
  getPhotosForReport,
  getDatabaseStats,
  deletePhoto as deletePhotoFromDB,
  getComplianceResultsForReport,
  saveComplianceResult as saveComplianceResultToDB,
} from "../lib/sqlite";
import type { LocalReportDraft, LocalPhoto, LocalChecklist, LocalTemplate, LocalComplianceResult } from "../types/database";

export function useLocalDB() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Report operations
  const getReports = useCallback(async (): Promise<LocalReportDraft[]> => {
    setIsLoading(true);
    setError(null);
    try {
      return await getAllReportDrafts();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to get reports"));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getReport = useCallback(async (id: string): Promise<LocalReportDraft | null> => {
    setIsLoading(true);
    setError(null);
    try {
      return await getReportDraft(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to get report"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveReport = useCallback(async (report: LocalReportDraft): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await saveReportDraft(report);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save report"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Checklist operations
  const getChecklists = useCallback(async (): Promise<LocalChecklist[]> => {
    try {
      return await getAllChecklists();
    } catch (err) {
      console.error("Failed to get checklists:", err);
      return [];
    }
  }, []);

  // Template operations
  const getTemplates = useCallback(async (): Promise<LocalTemplate[]> => {
    try {
      return await getAllTemplates();
    } catch (err) {
      console.error("Failed to get templates:", err);
      return [];
    }
  }, []);

  // Photo operations
  const getPhotos = useCallback(async (reportId: string): Promise<LocalPhoto[]> => {
    try {
      return await getPhotosForReport(reportId);
    } catch (err) {
      console.error("Failed to get photos:", err);
      return [];
    }
  }, []);

  const deletePhoto = useCallback(async (id: string): Promise<void> => {
    try {
      await deletePhotoFromDB(id);
    } catch (err) {
      console.error("Failed to delete photo:", err);
      throw err;
    }
  }, []);

  // Compliance operations
  const getComplianceResults = useCallback(async (reportId: string): Promise<LocalComplianceResult[]> => {
    try {
      return await getComplianceResultsForReport(reportId);
    } catch (err) {
      console.error("Failed to get compliance results:", err);
      return [];
    }
  }, []);

  const saveComplianceResult = useCallback(async (result: LocalComplianceResult): Promise<void> => {
    try {
      await saveComplianceResultToDB(result);
    } catch (err) {
      console.error("Failed to save compliance result:", err);
      throw err;
    }
  }, []);

  // Stats
  const getStats = useCallback(async () => {
    try {
      return await getDatabaseStats();
    } catch (err) {
      console.error("Failed to get stats:", err);
      return { reports: 0, photos: 0, pendingSync: 0, checklists: 0 };
    }
  }, []);

  return {
    isLoading,
    error,
    getReports,
    getReport,
    saveReport,
    getChecklists,
    getTemplates,
    getPhotos,
    deletePhoto,
    getComplianceResults,
    saveComplianceResult,
    getStats,
  };
}

export default useLocalDB;
