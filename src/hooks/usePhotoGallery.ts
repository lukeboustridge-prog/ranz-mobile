/**
 * usePhotoGallery Hook
 * Photo gallery state management with filtering, sorting, and grouping
 *
 * Purpose: Inspectors need to quickly find specific photos among potentially
 * hundreds captured during an inspection. This hook provides filtering
 * (by type, tag, element, defect, annotations), sorting (by date), and
 * grouping (by date, element, tag, defect) capabilities that power the gallery UI.
 *
 * @example
 * ```tsx
 * const {
 *   photos,
 *   groupedPhotos,
 *   filters,
 *   setFilters,
 *   groupBy,
 *   setGroupBy,
 *   sortOrder,
 *   setSortOrder,
 *   totalCount,
 *   filteredCount,
 *   clearFilters,
 * } = usePhotoGallery(allPhotos);
 *
 * // Filter by defect
 * setFilters({ defectId: 'defect-123' });
 *
 * // Group by date for SectionList
 * setGroupBy('date');
 *
 * // Use groupedPhotos with SectionList
 * <SectionList
 *   sections={groupedPhotos}
 *   renderSectionHeader={({ section }) => <Text>{section.title}</Text>}
 *   renderItem={({ item }) => <PhotoThumbnail photo={item} />}
 * />
 * ```
 */

import { useMemo, useState, useCallback } from "react";
import type { LocalPhoto } from "../types/database";
import type { PhotoType, QuickTag, ElementType } from "../types/shared";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Filter criteria for photo gallery
 * All filters are optional - only applied if set
 */
export interface PhotoFilters {
  /** Filter by photo type (OVERVIEW, CONTEXT, DETAIL, etc.) */
  photoType?: PhotoType;
  /** Filter by quick tag (DEFECT, GOOD, INACCESSIBLE) */
  quickTag?: QuickTag;
  /** Filter by element type (ROOF_CLADDING, RIDGE, etc.) */
  elementType?: ElementType;
  /** Filter by associated defect ID */
  defectId?: string;
  /** Filter by associated roof element ID */
  roofElementId?: string;
  /** Filter to only photos with annotations */
  hasAnnotations?: boolean;
  /** Filter by date range (inclusive) */
  dateRange?: { start: Date; end: Date };
}

/**
 * Section structure for React Native SectionList
 */
export interface PhotoSection {
  /** Section header title (e.g., "Today", "Yesterday", "7 Feb 2026") */
  title: string;
  /** Photos in this section */
  data: LocalPhoto[];
}

/**
 * Grouping options for photo gallery
 */
export type GroupBy = "date" | "element" | "tag" | "defect" | "none";

/**
 * Sort order for photos
 */
export type SortOrder = "asc" | "desc";

/**
 * Return type for usePhotoGallery hook
 */
export interface UsePhotoGalleryReturn {
  /** Filtered and sorted photos (flat array) */
  photos: LocalPhoto[];
  /** Grouped photos for SectionList */
  groupedPhotos: PhotoSection[];
  /** Current active filters */
  filters: PhotoFilters;
  /** Update filters (partial update supported) */
  setFilters: (filters: PhotoFilters) => void;
  /** Current grouping mode */
  groupBy: GroupBy;
  /** Set grouping mode */
  setGroupBy: (groupBy: GroupBy) => void;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Set sort order */
  setSortOrder: (order: SortOrder) => void;
  /** Total count of all photos (before filtering) */
  totalCount: number;
  /** Count of photos after filtering */
  filteredCount: number;
  /** Clear all filters */
  clearFilters: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format a date for section headers
 * Returns "Today", "Yesterday", or formatted date (e.g., "7 Feb 2026")
 */
function formatDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const photoDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (photoDate.getTime() === today.getTime()) {
    return "Today";
  }

  if (photoDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  // Format: "7 Feb 2026"
  const day = date.getDate();
  const month = date.toLocaleDateString("en-NZ", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Get date key for grouping (YYYY-MM-DD format)
 */
function getDateKey(dateString: string | null): string {
  if (!dateString) return "unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "unknown";
  return date.toISOString().split("T")[0];
}

/**
 * Check if a photo has annotations
 * Annotations are stored as JSON string - check if not null and not empty array
 */
function hasAnnotationsCheck(photo: LocalPhoto): boolean {
  if (!photo.annotationsJson) return false;
  try {
    const annotations = JSON.parse(photo.annotationsJson);
    return Array.isArray(annotations) && annotations.length > 0;
  } catch {
    return false;
  }
}

/**
 * Apply filters to a photo
 * Returns true if photo passes all active filters
 */
function matchesFilters(photo: LocalPhoto, filters: PhotoFilters): boolean {
  // Filter by photoType
  if (filters.photoType && photo.photoType !== filters.photoType) {
    return false;
  }

  // Filter by quickTag
  if (filters.quickTag && photo.quickTag !== filters.quickTag) {
    return false;
  }

  // Filter by defectId
  if (filters.defectId && photo.defectId !== filters.defectId) {
    return false;
  }

  // Filter by roofElementId
  if (filters.roofElementId && photo.roofElementId !== filters.roofElementId) {
    return false;
  }

  // Filter by hasAnnotations
  if (filters.hasAnnotations !== undefined) {
    const hasAnno = hasAnnotationsCheck(photo);
    if (filters.hasAnnotations !== hasAnno) {
      return false;
    }
  }

  // Filter by dateRange
  if (filters.dateRange) {
    const photoDate = photo.capturedAt
      ? new Date(photo.capturedAt)
      : new Date(photo.createdAt);

    const startOfDay = new Date(filters.dateRange.start);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(filters.dateRange.end);
    endOfDay.setHours(23, 59, 59, 999);

    if (photoDate < startOfDay || photoDate > endOfDay) {
      return false;
    }
  }

  return true;
}

/**
 * Sort photos by date
 */
function sortPhotos(photos: LocalPhoto[], order: SortOrder): LocalPhoto[] {
  return [...photos].sort((a, b) => {
    const dateA = a.capturedAt
      ? new Date(a.capturedAt).getTime()
      : new Date(a.createdAt).getTime();
    const dateB = b.capturedAt
      ? new Date(b.capturedAt).getTime()
      : new Date(b.createdAt).getTime();

    return order === "desc" ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Group photos into sections
 */
function groupPhotos(
  photos: LocalPhoto[],
  groupBy: GroupBy
): PhotoSection[] {
  if (groupBy === "none") {
    return photos.length > 0 ? [{ title: "All Photos", data: photos }] : [];
  }

  const groups = new Map<string, LocalPhoto[]>();

  for (const photo of photos) {
    let key: string;

    switch (groupBy) {
      case "date": {
        const dateStr = photo.capturedAt || photo.createdAt;
        key = getDateKey(dateStr);
        break;
      }
      case "element":
        key = photo.roofElementId || "general";
        break;
      case "tag":
        key = photo.quickTag || "untagged";
        break;
      case "defect":
        key = photo.defectId || "general";
        break;
      default:
        key = "unknown";
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(photo);
  }

  // Convert map to sections with formatted titles
  const sections: PhotoSection[] = [];

  // Sort group keys appropriately
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (groupBy === "date") {
      // Sort dates descending (newest first)
      return b.localeCompare(a);
    }
    // Sort alphabetically for other group types
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const data = groups.get(key)!;
    let title: string;

    switch (groupBy) {
      case "date": {
        if (key === "unknown") {
          title = "Unknown Date";
        } else {
          const date = new Date(key);
          title = formatDateGroup(date);
        }
        break;
      }
      case "element":
        title = key === "general" ? "General" : key;
        break;
      case "tag":
        title = key === "untagged" ? "Untagged" : key;
        break;
      case "defect":
        title = key === "general" ? "General" : `Defect: ${key}`;
        break;
      default:
        title = key;
    }

    sections.push({ title, data });
  }

  return sections;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * Photo gallery hook for filtering, sorting, and grouping photos
 *
 * @param allPhotos - Array of all photos to manage
 * @param initialFilters - Optional initial filter state
 * @returns Photo gallery state and controls
 */
export function usePhotoGallery(
  allPhotos: LocalPhoto[],
  initialFilters?: PhotoFilters
): UsePhotoGalleryReturn {
  // State
  const [filters, setFiltersState] = useState<PhotoFilters>(
    initialFilters ?? {}
  );
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filtered photos (memoized)
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter((photo) => matchesFilters(photo, filters));
  }, [allPhotos, filters]);

  // Sorted photos (memoized)
  const sortedPhotos = useMemo(() => {
    return sortPhotos(filteredPhotos, sortOrder);
  }, [filteredPhotos, sortOrder]);

  // Grouped photos for SectionList (memoized)
  const groupedPhotos = useMemo(() => {
    return groupPhotos(sortedPhotos, groupBy);
  }, [sortedPhotos, groupBy]);

  // Callbacks
  const setFilters = useCallback((newFilters: PhotoFilters) => {
    setFiltersState(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  return {
    photos: sortedPhotos,
    groupedPhotos,
    filters,
    setFilters,
    groupBy,
    setGroupBy,
    sortOrder,
    setSortOrder,
    totalCount: allPhotos.length,
    filteredCount: filteredPhotos.length,
    clearFilters,
  };
}
