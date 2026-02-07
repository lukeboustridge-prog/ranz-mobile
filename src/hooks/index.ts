/**
 * Hooks Exports
 * Central export file for all custom hooks
 */

// Authentication
export { useAuth } from "./useAuth";

// Network & Sync
export { useNetworkStatus } from "./useNetworkStatus";
export { useSyncEngine } from "./useSyncEngine";
export { useSyncStatus, useBackgroundSyncAvailable } from "./useSyncStatus";
export type { SyncStatusHook } from "./useSyncStatus";
export { useSyncSettings, checkCanUploadPhoto } from "./useSyncSettings";
export type { SyncSettingsHook } from "./useSyncSettings";

// Database
export { useLocalDB } from "./useLocalDB";

// Photo Annotations
export { usePhotoAnnotations } from "./usePhotoAnnotations";

// Permissions
export { usePermissions } from "./usePermissions";
export type {
  PermissionStatus,
  PermissionState,
  UsePermissionsReturn,
} from "./usePermissions";

// Photo Gallery
export { usePhotoGallery } from "./usePhotoGallery";
export type {
  PhotoFilters,
  PhotoSection,
  GroupBy,
  SortOrder,
  UsePhotoGalleryReturn,
} from "./usePhotoGallery";
