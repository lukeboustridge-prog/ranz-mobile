/**
 * Thumbnail Service
 * Generates and manages photo thumbnails for efficient grid display
 *
 * Thumbnails are generated at 200px width with 70% JPEG quality.
 * This reduces memory pressure and improves scrolling performance
 * when displaying photo grids.
 *
 * CRITICAL: Thumbnail generation is non-blocking - failures should
 * not prevent photo capture from completing. Use graceful degradation.
 */

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  getInfoAsync,
  deleteAsync,
} from "expo-file-system/legacy";
import { STORAGE_PATHS } from "../lib/file-storage";
import { photoLogger } from "../lib/logger";
import type { LocalPhoto } from "../types/database";

// ============================================
// CONSTANTS
// ============================================

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_QUALITY = 0.7;

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate a thumbnail for a photo
 *
 * Creates a resized JPEG thumbnail at 200px width with 70% quality.
 * The thumbnail is saved to the thumbnails directory.
 *
 * @param sourceUri - Path to the source image file
 * @param photoId - Unique identifier for the photo
 * @returns Path to the generated thumbnail, or sourceUri as fallback on error
 *
 * @example
 * ```typescript
 * const thumbnailPath = await generateThumbnail(workingCopyUri, photoId);
 * // Returns: file:///path/to/thumbnails/thumb_photo_123.jpg
 * ```
 */
export async function generateThumbnail(
  sourceUri: string,
  photoId: string
): Promise<string> {
  const thumbnailPath = getThumbnailPath(photoId);

  try {
    // Check if thumbnail already exists (idempotent)
    const existingInfo = await getInfoAsync(thumbnailPath);
    if (existingInfo.exists) {
      photoLogger.debug("Thumbnail already exists", { photoId, thumbnailPath });
      return thumbnailPath;
    }

    // Ensure thumbnails directory exists
    const dirInfo = await getInfoAsync(STORAGE_PATHS.thumbnails);
    if (!dirInfo.exists) {
      // Directory creation is handled by ensureStorageDirectories in app startup
      // but we check just in case
      photoLogger.warn("Thumbnails directory does not exist", {
        path: STORAGE_PATHS.thumbnails,
      });
    }

    // Generate thumbnail using expo-image-manipulator
    const result = await manipulateAsync(
      sourceUri,
      [{ resize: { width: THUMBNAIL_WIDTH } }],
      {
        compress: THUMBNAIL_QUALITY,
        format: SaveFormat.JPEG,
      }
    );

    // Move the result to our thumbnails directory with proper naming
    // manipulateAsync returns the result in a cache directory
    const finalResult = await manipulateAsync(
      result.uri,
      [],
      {
        compress: THUMBNAIL_QUALITY,
        format: SaveFormat.JPEG,
        base64: false,
      }
    );

    // Copy to our thumbnail location by re-manipulating with the correct output path
    // Note: expo-image-manipulator doesn't support custom output paths directly
    // We use a second manipulation to ensure consistent format
    const thumbnailResult = await manipulateAsync(
      sourceUri,
      [{ resize: { width: THUMBNAIL_WIDTH } }],
      {
        compress: THUMBNAIL_QUALITY,
        format: SaveFormat.JPEG,
      }
    );

    // Move from cache to thumbnails directory
    const { moveAsync } = await import("expo-file-system/legacy");
    await moveAsync({
      from: thumbnailResult.uri,
      to: thumbnailPath,
    });

    photoLogger.debug("Thumbnail generated", {
      photoId,
      thumbnailPath,
      originalUri: sourceUri,
    });

    return thumbnailPath;
  } catch (error) {
    // Graceful degradation: return source URI as fallback
    // This ensures photo capture is not blocked by thumbnail failures
    photoLogger.warn("Failed to generate thumbnail, using source as fallback", {
      photoId,
      sourceUri,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return sourceUri;
  }
}

/**
 * Delete a photo's thumbnail
 *
 * Removes the thumbnail file from disk if it exists.
 * Uses idempotent deletion to avoid errors on missing files.
 *
 * @param photoId - Unique identifier for the photo
 *
 * @example
 * ```typescript
 * await deleteThumbnail(photoId);
 * ```
 */
export async function deleteThumbnail(photoId: string): Promise<void> {
  const thumbnailPath = getThumbnailPath(photoId);

  try {
    await deleteAsync(thumbnailPath, { idempotent: true });
    photoLogger.debug("Thumbnail deleted", { photoId, thumbnailPath });
  } catch (error) {
    // Log but don't throw - deletion failures are non-critical
    photoLogger.warn("Failed to delete thumbnail", {
      photoId,
      thumbnailPath,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Regenerate thumbnails for multiple photos
 *
 * Useful for batch regeneration after migration or if thumbnails
 * become corrupted. Processes photos sequentially to avoid
 * overwhelming the device.
 *
 * @param photos - Array of LocalPhoto objects to regenerate thumbnails for
 * @returns Object with counts of successful and failed regenerations
 *
 * @example
 * ```typescript
 * const photos = await getPhotosForReport(reportId);
 * const result = await regenerateThumbnails(photos);
 * console.log(`Success: ${result.success}, Failed: ${result.failed}`);
 * ```
 */
export async function regenerateThumbnails(
  photos: LocalPhoto[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const photo of photos) {
    try {
      // Delete existing thumbnail first
      await deleteThumbnail(photo.id);

      // Generate new thumbnail
      const result = await generateThumbnail(photo.localUri, photo.id);

      // Check if we got a real thumbnail or fallback
      if (result !== photo.localUri) {
        success++;
      } else {
        // Fallback was used, count as failed
        failed++;
      }
    } catch (error) {
      photoLogger.warn("Failed to regenerate thumbnail", {
        photoId: photo.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      failed++;
    }
  }

  photoLogger.info("Thumbnail regeneration complete", {
    total: photos.length,
    success,
    failed,
  });

  return { success, failed };
}

/**
 * Get the path where a thumbnail should be stored
 *
 * Returns the expected path for a photo's thumbnail.
 * Does NOT check if the file actually exists.
 *
 * @param photoId - Unique identifier for the photo
 * @returns Absolute path to the thumbnail location
 *
 * @example
 * ```typescript
 * const path = getThumbnailPath("photo_123");
 * // Returns: file:///path/to/thumbnails/thumb_photo_123.jpg
 * ```
 */
export function getThumbnailPath(photoId: string): string {
  return `${STORAGE_PATHS.thumbnails}thumb_${photoId}.jpg`;
}
