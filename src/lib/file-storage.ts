/**
 * File Storage Service
 * Manages immutable originals and working file directories
 *
 * CRITICAL: The originals/ directory must NEVER be modified by app code
 * after initial write. This ensures evidence integrity for court proceedings.
 *
 * Directory structure:
 * - evidence/originals/  <- IMMUTABLE after initial copy (never modified)
 * - photos/              <- Working copies for display/annotation
 * - thumbnails/          <- Generated thumbnails
 * - temp/                <- Temporary capture files (cleaned periodically)
 */

import {
  documentDirectory,
  makeDirectoryAsync,
  copyAsync,
  getInfoAsync,
  readAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import type { StoragePaths } from "../types/evidence";

/**
 * Storage paths - originals directory is IMMUTABLE after initial write
 *
 * CRITICAL: Do not add delete or modify functions for the originals directory.
 * Evidence integrity depends on these files never being altered.
 */
export const STORAGE_PATHS: StoragePaths = {
  originals: `${documentDirectory}evidence/originals/`,
  photos: `${documentDirectory}photos/`,
  thumbnails: `${documentDirectory}thumbnails/`,
  temp: `${documentDirectory}temp/`,
};

/**
 * Ensure all storage directories exist
 *
 * Call this on app startup to initialize the directory structure.
 * Uses `intermediates: true` to create parent directories as needed.
 */
export async function ensureStorageDirectories(): Promise<void> {
  const dirs = Object.values(STORAGE_PATHS);

  for (const dir of dirs) {
    const info = await getInfoAsync(dir);
    if (!info.exists) {
      await makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

/**
 * Copy a file to the immutable originals directory
 *
 * CRITICAL: This is a ONE-WAY operation. Files in originals/ must
 * never be modified, moved, or deleted by app code. This ensures
 * evidence integrity for court proceedings.
 *
 * @param sourcePath - Path to the source file (typically in temp/)
 * @param filename - Filename to use in originals directory
 * @returns Path to the file in originals directory
 */
export async function copyToOriginals(
  sourcePath: string,
  filename: string
): Promise<string> {
  const originalPath = `${STORAGE_PATHS.originals}${filename}`;

  // Ensure the originals directory exists
  const dirInfo = await getInfoAsync(STORAGE_PATHS.originals);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(STORAGE_PATHS.originals, { intermediates: true });
  }

  await copyAsync({
    from: sourcePath,
    to: originalPath,
  });

  return originalPath;
}

/**
 * Get the path for a file in the originals directory
 *
 * @param filename - The filename
 * @returns Absolute path in the originals directory
 */
export function getOriginalPath(filename: string): string {
  return `${STORAGE_PATHS.originals}${filename}`;
}

/**
 * Get the path for a file in the working photos directory
 *
 * Working photos can be annotated and modified without affecting
 * the immutable originals.
 *
 * @param filename - The filename
 * @returns Absolute path in the photos directory
 */
export function getWorkingPath(filename: string): string {
  return `${STORAGE_PATHS.photos}${filename}`;
}

/**
 * Get the path for a thumbnail
 *
 * @param filename - The filename
 * @returns Absolute path in the thumbnails directory
 */
export function getThumbnailPath(filename: string): string {
  return `${STORAGE_PATHS.thumbnails}${filename}`;
}

/**
 * Get the path for a temporary file
 *
 * Temporary files are used during capture before being
 * copied to their final locations.
 *
 * @param filename - The filename
 * @returns Absolute path in the temp directory
 */
export function getTempPath(filename: string): string {
  return `${STORAGE_PATHS.temp}${filename}`;
}

/**
 * Read a file as base64 string
 *
 * Used for hashing file contents. The base64 encoding allows
 * the content to be passed to the crypto digest function.
 *
 * @param path - Absolute path to the file
 * @returns Base64-encoded file content
 */
export async function readFileAsBase64(path: string): Promise<string> {
  return readAsStringAsync(path, {
    encoding: EncodingType.Base64,
  });
}

/**
 * Check if a file exists in the originals directory
 *
 * @param filename - The filename to check
 * @returns True if the file exists
 */
export async function originalExists(filename: string): Promise<boolean> {
  const path = getOriginalPath(filename);
  const info = await getInfoAsync(path);
  return info.exists;
}

/**
 * Get file info for any path
 *
 * @param path - Absolute path to the file
 * @returns Object with exists, size, and modificationTime
 */
export async function getFileInfo(path: string): Promise<{
  exists: boolean;
  size: number | null;
  modificationTime: number | null;
}> {
  const info = await getInfoAsync(path);

  if (!info.exists) {
    return { exists: false, size: null, modificationTime: null };
  }

  return {
    exists: true,
    size: (info as { size?: number }).size ?? null,
    modificationTime: (info as { modificationTime?: number }).modificationTime ?? null,
  };
}

/**
 * Copy a file to the working photos directory
 *
 * Creates a working copy that can be annotated without
 * affecting the immutable original.
 *
 * @param sourcePath - Path to the source file
 * @param filename - Filename to use in photos directory
 * @returns Path to the file in photos directory
 */
export async function copyToWorking(
  sourcePath: string,
  filename: string
): Promise<string> {
  const workingPath = `${STORAGE_PATHS.photos}${filename}`;

  // Ensure the photos directory exists
  const dirInfo = await getInfoAsync(STORAGE_PATHS.photos);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(STORAGE_PATHS.photos, { intermediates: true });
  }

  await copyAsync({
    from: sourcePath,
    to: workingPath,
  });

  return workingPath;
}

/**
 * Generate a unique filename for evidence
 *
 * Format: evidence_{timestamp}_{random}.{extension}
 *
 * @param extension - File extension (e.g., "jpg", "mp4")
 * @returns Unique filename
 */
export function generateEvidenceFilename(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `evidence_${timestamp}_${random}.${extension}`;
}
