/**
 * useLocalDB Hook
 * Provides access to local SQLite database operations
 * Note: SQLite is not available on web - functions return empty data on web platform
 */

import { useState, useCallback } from "react";
import { Platform } from "react-native";
import type {
  LocalReport,
  LocalPhoto,
  LocalChecklist,
  LocalTemplate,
  LocalComplianceAssessment,
  LocalRoofElement,
  LocalDefect,
} from "../types/database";

const isNative = Platform.OS !== "web";

// Helper to get sqlite module dynamically (only on native)
async function getSqlite() {
  if (!isNative) return null;
  return import("../lib/sqlite");
}

export function useLocalDB() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Report operations
  const getReports = useCallback(async (): Promise<LocalReport[]> => {
    if (!isNative) return [];
    setIsLoading(true);
    setError(null);
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getAllReports() : [];
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to get reports"));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getReport = useCallback(async (id: string): Promise<LocalReport | null> => {
    if (!isNative) return null;
    setIsLoading(true);
    setError(null);
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getReport(id) : null;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to get report"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getReportWithRelations = useCallback(async (id: string) => {
    if (!isNative) return null;
    setIsLoading(true);
    setError(null);
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getReportWithRelations(id) : null;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to get report"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveReport = useCallback(async (report: LocalReport): Promise<void> => {
    if (!isNative) {
      console.log("[useLocalDB] Web mode - saveReport not available");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.saveReport(report);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save report"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteReport = useCallback(async (id: string): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.deleteReport(id);
    } catch (err) {
      console.error("Failed to delete report:", err);
      throw err;
    }
  }, []);

  // Roof Element operations
  const getRoofElements = useCallback(async (reportId: string): Promise<LocalRoofElement[]> => {
    if (!isNative) return [];
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getRoofElementsForReport(reportId) : [];
    } catch (err) {
      console.error("Failed to get roof elements:", err);
      return [];
    }
  }, []);

  const saveRoofElement = useCallback(async (element: LocalRoofElement): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.saveRoofElement(element);
    } catch (err) {
      console.error("Failed to save roof element:", err);
      throw err;
    }
  }, []);

  const deleteRoofElement = useCallback(async (id: string): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.deleteRoofElement(id);
    } catch (err) {
      console.error("Failed to delete roof element:", err);
      throw err;
    }
  }, []);

  // Defect operations
  const getDefects = useCallback(async (reportId: string): Promise<LocalDefect[]> => {
    if (!isNative) return [];
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getDefectsForReport(reportId) : [];
    } catch (err) {
      console.error("Failed to get defects:", err);
      return [];
    }
  }, []);

  const saveDefect = useCallback(async (defect: LocalDefect): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.saveDefect(defect);
    } catch (err) {
      console.error("Failed to save defect:", err);
      throw err;
    }
  }, []);

  const deleteDefect = useCallback(async (id: string): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.deleteDefect(id);
    } catch (err) {
      console.error("Failed to delete defect:", err);
      throw err;
    }
  }, []);

  const getNextDefectNumber = useCallback(async (reportId: string): Promise<number> => {
    if (!isNative) return 1;
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getNextDefectNumber(reportId) : 1;
    } catch (err) {
      console.error("Failed to get next defect number:", err);
      return 1;
    }
  }, []);

  // Checklist operations
  const getChecklists = useCallback(async (): Promise<LocalChecklist[]> => {
    if (!isNative) return [];
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getAllChecklists() : [];
    } catch (err) {
      console.error("Failed to get checklists:", err);
      return [];
    }
  }, []);

  // Template operations
  const getTemplates = useCallback(async (): Promise<LocalTemplate[]> => {
    if (!isNative) return [];
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getAllTemplates() : [];
    } catch (err) {
      console.error("Failed to get templates:", err);
      return [];
    }
  }, []);

  // Photo operations
  const getPhotos = useCallback(async (reportId: string): Promise<LocalPhoto[]> => {
    if (!isNative) return [];
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getPhotosForReport(reportId) : [];
    } catch (err) {
      console.error("Failed to get photos:", err);
      return [];
    }
  }, []);

  const getPhotoById = useCallback(async (id: string): Promise<LocalPhoto | null> => {
    if (!isNative) return null;
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getPhotoById(id) : null;
    } catch (err) {
      console.error("Failed to get photo:", err);
      return null;
    }
  }, []);

  const getPhotosForDefect = useCallback(async (defectId: string): Promise<LocalPhoto[]> => {
    if (!isNative) return [];
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getPhotosForDefect(defectId) : [];
    } catch (err) {
      console.error("Failed to get photos for defect:", err);
      return [];
    }
  }, []);

  const savePhoto = useCallback(async (photo: LocalPhoto): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.savePhoto(photo);
    } catch (err) {
      console.error("Failed to save photo:", err);
      throw err;
    }
  }, []);

  const deletePhoto = useCallback(async (id: string): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.deletePhoto(id);
    } catch (err) {
      console.error("Failed to delete photo:", err);
      throw err;
    }
  }, []);

  const updatePhotoClassification = useCallback(async (
    id: string,
    updates: {
      photoType?: string;
      quickTag?: string | null;
      caption?: string | null;
    }
  ): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.updatePhotoClassification(id, updates);
    } catch (err) {
      console.error("Failed to update photo classification:", err);
      throw err;
    }
  }, []);

  // Compliance operations
  const getComplianceAssessment = useCallback(async (reportId: string): Promise<LocalComplianceAssessment | null> => {
    if (!isNative) return null;
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getComplianceAssessment(reportId) : null;
    } catch (err) {
      console.error("Failed to get compliance assessment:", err);
      return null;
    }
  }, []);

  const saveComplianceAssessment = useCallback(async (assessment: LocalComplianceAssessment): Promise<void> => {
    if (!isNative) return;
    try {
      const sqlite = await getSqlite();
      if (sqlite) await sqlite.saveComplianceAssessment(assessment);
    } catch (err) {
      console.error("Failed to save compliance assessment:", err);
      throw err;
    }
  }, []);

  // Stats
  const getStats = useCallback(async () => {
    if (!isNative) return { reports: 0, photos: 0, defects: 0, elements: 0, pendingSync: 0, checklists: 0 };
    try {
      const sqlite = await getSqlite();
      return sqlite ? await sqlite.getDatabaseStats() : { reports: 0, photos: 0, defects: 0, elements: 0, pendingSync: 0, checklists: 0 };
    } catch (err) {
      console.error("Failed to get stats:", err);
      return { reports: 0, photos: 0, defects: 0, elements: 0, pendingSync: 0, checklists: 0 };
    }
  }, []);

  return {
    isLoading,
    error,
    isNative,
    // Reports
    getReports,
    getReport,
    getReportWithRelations,
    saveReport,
    deleteReport,
    // Roof Elements
    getRoofElements,
    saveRoofElement,
    deleteRoofElement,
    // Defects
    getDefects,
    saveDefect,
    deleteDefect,
    getNextDefectNumber,
    // Checklists & Templates
    getChecklists,
    getTemplates,
    // Photos
    getPhotos,
    getPhotoById,
    getPhotosForDefect,
    savePhoto,
    deletePhoto,
    updatePhotoClassification,
    // Compliance
    getComplianceAssessment,
    saveComplianceAssessment,
    // Stats
    getStats,
  };
}

export default useLocalDB;
