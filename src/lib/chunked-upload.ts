/**
 * Chunked Upload Library
 * Resumable uploads for large video files using TUS protocol
 *
 * TUS (https://tus.io) is an industry-standard protocol for resumable uploads.
 * When uploads are interrupted (network drop, app background), they resume
 * from the last successful chunk rather than restarting from scratch.
 */

import * as tus from "tus-js-client";
import * as FileSystem from "expo-file-system/legacy";

// ============================================
// TYPES
// ============================================

export interface ChunkedUploadOptions {
  /** Local file URI to upload */
  fileUri: string;
  /** TUS endpoint URL (server must support TUS protocol) */
  endpoint: string;
  /** Metadata to attach to upload (filename, hash, etc.) */
  metadata: Record<string, string>;
  /** Callback for upload progress */
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  /** Callback on successful upload completion */
  onSuccess?: (url: string) => void;
  /** Callback on upload error */
  onError?: (error: Error) => void;
}

export interface ChunkedUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  bytesUploaded: number;
}

// ============================================
// CONSTANTS
// ============================================

/** Chunk size: 5MB chunks balance between resume granularity and overhead */
const CHUNK_SIZE = 5 * 1024 * 1024;

/** Retry delays in milliseconds for transient failures */
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

/** Minimum file size (10MB) to use chunked upload - smaller files use direct upload */
export const CHUNKED_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

// ============================================
// UPLOAD FUNCTION
// ============================================

/**
 * Upload a file using TUS resumable protocol
 *
 * @param options - Upload configuration
 * @returns Promise resolving to upload result with final URL
 *
 * @example
 * ```typescript
 * const result = await uploadWithResume({
 *   fileUri: video.localUri,
 *   endpoint: "https://api.ranz.org.nz/api/upload/video",
 *   metadata: {
 *     filename: video.filename,
 *     originalHash: video.originalHash,
 *     reportId: video.reportId,
 *   },
 *   onProgress: (uploaded, total) => {
 *     console.log(`${Math.round(uploaded/total*100)}% complete`);
 *   },
 * });
 * ```
 */
export async function uploadWithResume(
  options: ChunkedUploadOptions
): Promise<ChunkedUploadResult> {
  const { fileUri, endpoint, metadata, onProgress, onSuccess, onError } = options;

  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File not found: " + fileUri);
    }
    const fileSize = (fileInfo as { size: number }).size;

    // Read file as blob for tus-js-client
    const response = await fetch(fileUri);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const upload = new tus.Upload(blob, {
        endpoint,
        retryDelays: RETRY_DELAYS,
        chunkSize: CHUNK_SIZE,
        metadata,
        onError: (error) => {
          console.error("[ChunkedUpload] Upload failed:", error);
          onError?.(error);
          resolve({
            success: false,
            error: error.message,
            bytesUploaded: 0,
          });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          onProgress?.(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          const url = upload.url || "";
          console.log("[ChunkedUpload] Upload complete:", url);
          onSuccess?.(url);
          resolve({
            success: true,
            url,
            bytesUploaded: fileSize,
          });
        },
      });

      // Check for previous upload to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          console.log("[ChunkedUpload] Resuming previous upload");
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ChunkedUpload] Setup failed:", error);
    onError?.(error instanceof Error ? error : new Error(errorMessage));
    return {
      success: false,
      error: errorMessage,
      bytesUploaded: 0,
    };
  }
}

/**
 * Check if a file should use chunked upload based on size
 */
export function shouldUseChunkedUpload(fileSize: number): boolean {
  return fileSize >= CHUNKED_UPLOAD_THRESHOLD;
}
