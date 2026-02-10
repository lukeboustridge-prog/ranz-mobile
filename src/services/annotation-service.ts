/**
 * Annotation Service
 * Handles saving and loading photo annotations with database persistence
 */

import {
  documentDirectory,
  makeDirectoryAsync,
  moveAsync,
  getInfoAsync,
  copyAsync,
} from "expo-file-system/legacy";
import {
  getPhotoById,
  updatePhotoAnnotations,
  markReportDirty,
} from "../lib/sqlite";
import type { Annotation } from "../components/PhotoAnnotator";
import type { LocalPhoto } from "../types/database";

// ============================================
// TYPES
// ============================================

export interface AnnotationData {
  annotations: Annotation[];
  annotatedUri: string | null;
}

export interface SaveAnnotationResult {
  success: boolean;
  annotatedUri?: string;
  error?: string;
}

// ============================================
// ANNOTATION SERVICE CLASS
// ============================================

class AnnotationService {
  private annotationsDir: string;

  constructor() {
    this.annotationsDir = `${documentDirectory}annotations/`;
  }

  /**
   * Ensure the annotations directory exists
   */
  private async ensureAnnotationsDir(): Promise<void> {
    const dirInfo = await getInfoAsync(this.annotationsDir);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(this.annotationsDir, { intermediates: true });
    }
  }

  /**
   * Load annotations for a photo
   */
  async loadAnnotations(photoId: string): Promise<AnnotationData | null> {
    try {
      const photo = await getPhotoById(photoId);
      if (!photo) {
        console.warn("[AnnotationService] Photo not found:", photoId);
        return null;
      }

      let annotations: Annotation[] = [];

      if (photo.annotationsJson) {
        try {
          annotations = JSON.parse(photo.annotationsJson) as Annotation[];
        } catch (parseError) {
          console.error("[AnnotationService] Failed to parse annotations JSON:", parseError);
          annotations = [];
        }
      }

      return {
        annotations,
        annotatedUri: photo.annotatedUri,
      };
    } catch (error) {
      console.error("[AnnotationService] Failed to load annotations:", error);
      return null;
    }
  }

  /**
   * Save annotations for a photo
   */
  async saveAnnotations(
    photoId: string,
    annotations: Annotation[],
    annotatedImageUri: string
  ): Promise<SaveAnnotationResult> {
    try {
      // Get photo details
      const photo = await getPhotoById(photoId);
      if (!photo) {
        return { success: false, error: "Photo not found" };
      }

      await this.ensureAnnotationsDir();

      // Generate filename for annotated image
      const timestamp = Date.now();
      const filename = `annotated_${photoId}_${timestamp}.jpg`;
      const permanentUri = `${this.annotationsDir}${filename}`;

      // Move/copy the annotated image to permanent storage
      // ViewShot creates a temp file, so we need to move it
      const tempFileInfo = await getInfoAsync(annotatedImageUri);
      if (!tempFileInfo.exists) {
        return { success: false, error: "Annotated image file not found" };
      }

      // Delete old annotated image if it exists
      if (photo.annotatedUri) {
        try {
          const oldFileInfo = await getInfoAsync(photo.annotatedUri);
          if (oldFileInfo.exists) {
            const { deleteAsync } = await import("expo-file-system/legacy");
            await deleteAsync(photo.annotatedUri, { idempotent: true });
          }
        } catch {
          // Ignore deletion errors
        }
      }

      // Copy to permanent location (moveAsync may fail if cross-device)
      await copyAsync({
        from: annotatedImageUri,
        to: permanentUri,
      });

      // Serialize annotations to JSON
      const annotationsJson = JSON.stringify(annotations);

      // Update database
      await updatePhotoAnnotations(photoId, annotationsJson, permanentUri);

      // Mark the report as dirty for sync
      await markReportDirty(photo.reportId);

      console.log("[AnnotationService] Annotations saved successfully", {
        photoId,
        annotationCount: annotations.length,
        annotatedUri: permanentUri,
      });

      return {
        success: true,
        annotatedUri: permanentUri,
      };
    } catch (error) {
      console.error("[AnnotationService] Failed to save annotations:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save annotations",
      };
    }
  }

  /**
   * Clear annotations for a photo
   */
  async clearAnnotations(photoId: string): Promise<SaveAnnotationResult> {
    try {
      const photo = await getPhotoById(photoId);
      if (!photo) {
        return { success: false, error: "Photo not found" };
      }

      // Delete annotated image file if it exists
      if (photo.annotatedUri) {
        try {
          const fileInfo = await getInfoAsync(photo.annotatedUri);
          if (fileInfo.exists) {
            const { deleteAsync } = await import("expo-file-system/legacy");
            await deleteAsync(photo.annotatedUri, { idempotent: true });
          }
        } catch {
          // Ignore deletion errors
        }
      }

      // Clear in database (pass empty JSON array and empty URI)
      await updatePhotoAnnotations(photoId, "[]", "");

      // Mark report dirty
      await markReportDirty(photo.reportId);

      console.log("[AnnotationService] Annotations cleared", { photoId });

      return { success: true };
    } catch (error) {
      console.error("[AnnotationService] Failed to clear annotations:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear annotations",
      };
    }
  }

  /**
   * Check if a photo has annotations
   */
  async hasAnnotations(photoId: string): Promise<boolean> {
    try {
      const photo = await getPhotoById(photoId);
      if (!photo) return false;

      if (!photo.annotationsJson) return false;

      const annotations = JSON.parse(photo.annotationsJson) as Annotation[];
      return annotations.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the display URI for a photo (annotated version if available, otherwise original)
   */
  async getDisplayUri(photoId: string): Promise<string | null> {
    try {
      const photo = await getPhotoById(photoId);
      if (!photo) return null;

      // If annotated version exists and has annotations, use it
      if (photo.annotatedUri && photo.annotationsJson) {
        const annotations = JSON.parse(photo.annotationsJson) as Annotation[];
        if (annotations.length > 0) {
          const fileInfo = await getInfoAsync(photo.annotatedUri);
          if (fileInfo.exists) {
            return photo.annotatedUri;
          }
        }
      }

      // Fall back to original
      return photo.localUri;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const annotationService = new AnnotationService();

// Export convenience functions
export async function loadAnnotations(photoId: string): Promise<AnnotationData | null> {
  return annotationService.loadAnnotations(photoId);
}

export async function saveAnnotations(
  photoId: string,
  annotations: Annotation[],
  annotatedImageUri: string
): Promise<SaveAnnotationResult> {
  return annotationService.saveAnnotations(photoId, annotations, annotatedImageUri);
}

export async function clearAnnotations(photoId: string): Promise<SaveAnnotationResult> {
  return annotationService.clearAnnotations(photoId);
}

export async function hasAnnotations(photoId: string): Promise<boolean> {
  return annotationService.hasAnnotations(photoId);
}

export async function getDisplayUri(photoId: string): Promise<string | null> {
  return annotationService.getDisplayUri(photoId);
}
