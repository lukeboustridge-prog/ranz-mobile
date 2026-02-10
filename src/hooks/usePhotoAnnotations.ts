/**
 * usePhotoAnnotations Hook
 * React hook for managing photo annotations with persistence
 */

import { useState, useEffect, useCallback } from "react";
import {
  loadAnnotations,
  saveAnnotations,
  clearAnnotations,
  hasAnnotations,
  getDisplayUri,
  type AnnotationData,
  type SaveAnnotationResult,
} from "../services/annotation-service";
import { getPhotoById } from "../lib/sqlite";
import type { Annotation } from "../components/PhotoAnnotator";
import type { LocalPhoto } from "../types/database";

export interface UsePhotoAnnotationsResult {
  // Photo data
  photo: LocalPhoto | null;
  isLoading: boolean;
  error: string | null;

  // Annotation data
  annotations: Annotation[];
  annotatedUri: string | null;
  hasAnnotations: boolean;

  // Display
  displayUri: string | null;

  // Actions
  save: (annotations: Annotation[], annotatedImageUri: string) => Promise<SaveAnnotationResult>;
  clear: () => Promise<SaveAnnotationResult>;
  refresh: () => Promise<void>;
}

export function usePhotoAnnotations(photoId: string | null): UsePhotoAnnotationsResult {
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotatedUri, setAnnotatedUri] = useState<string | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load photo and annotations
  const loadData = useCallback(async () => {
    if (!photoId) {
      setPhoto(null);
      setAnnotations([]);
      setAnnotatedUri(null);
      setDisplayUri(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load photo data
      const photoData = await getPhotoById(photoId);
      if (!photoData) {
        setError("Photo not found");
        setIsLoading(false);
        return;
      }

      setPhoto(photoData);

      // Load annotations
      const annotationData = await loadAnnotations(photoId);
      if (annotationData) {
        setAnnotations(annotationData.annotations);
        setAnnotatedUri(annotationData.annotatedUri);
      } else {
        setAnnotations([]);
        setAnnotatedUri(null);
      }

      // Get display URI
      const uri = await getDisplayUri(photoId);
      setDisplayUri(uri);
    } catch (err) {
      console.error("[usePhotoAnnotations] Failed to load:", err);
      setError(err instanceof Error ? err.message : "Failed to load photo");
    } finally {
      setIsLoading(false);
    }
  }, [photoId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save annotations
  const save = useCallback(
    async (newAnnotations: Annotation[], annotatedImageUri: string): Promise<SaveAnnotationResult> => {
      if (!photoId) {
        return { success: false, error: "No photo ID provided" };
      }

      try {
        const result = await saveAnnotations(photoId, newAnnotations, annotatedImageUri);

        if (result.success) {
          // Update local state
          setAnnotations(newAnnotations);
          setAnnotatedUri(result.annotatedUri ?? null);

          // Refresh display URI
          const uri = await getDisplayUri(photoId);
          setDisplayUri(uri);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to save annotations";
        return { success: false, error: errorMessage };
      }
    },
    [photoId]
  );

  // Clear annotations
  const clear = useCallback(async (): Promise<SaveAnnotationResult> => {
    if (!photoId) {
      return { success: false, error: "No photo ID provided" };
    }

    try {
      const result = await clearAnnotations(photoId);

      if (result.success) {
        // Update local state
        setAnnotations([]);
        setAnnotatedUri(null);

        // Reset display URI to original
        if (photo) {
          setDisplayUri(photo.localUri);
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to clear annotations";
      return { success: false, error: errorMessage };
    }
  }, [photoId, photo]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    photo,
    isLoading,
    error,
    annotations,
    annotatedUri,
    hasAnnotations: annotations.length > 0,
    displayUri,
    save,
    clear,
    refresh,
  };
}

/**
 * Simplified hook for just checking if a photo has annotations
 */
export function useHasAnnotations(photoId: string | null): {
  hasAnnotations: boolean;
  isLoading: boolean;
} {
  const [has, setHas] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!photoId) {
      setHas(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    hasAnnotations(photoId)
      .then(setHas)
      .catch(() => setHas(false))
      .finally(() => setIsLoading(false));
  }, [photoId]);

  return { hasAnnotations: has, isLoading };
}

export default usePhotoAnnotations;
