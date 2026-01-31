/**
 * HEIC Format Utilities
 * Detection and handling for iOS HEIC photo format
 *
 * expo-camera with skipProcessing: false returns JPEG by default.
 * These utilities are for:
 * 1. Validating photo format before processing
 * 2. Handling photos imported from camera roll (future feature)
 * 3. Ensuring consistent MIME type throughout the app
 */

import { Platform } from "react-native";

/**
 * HEIC magic bytes (first 12 bytes of file)
 * HEIC files start with 'ftyp' box containing 'heic', 'heix', 'hevc', or 'mif1'
 */
const HEIC_SIGNATURES = ["heic", "heix", "hevc", "mif1"];

/**
 * Check if a base64 string represents HEIC format
 *
 * @param base64Content - Base64 encoded file content
 * @returns true if content appears to be HEIC format
 *
 * @example
 * const isHeic = isHEICFormat(base64Content);
 * if (isHeic) {
 *   console.warn("HEIC detected - conversion may be needed");
 * }
 */
export function isHEICFormat(base64Content: string): boolean {
  try {
    // Decode first 24 bytes (enough to check ftyp box)
    const bytes = atob(base64Content.slice(0, 32));

    // HEIC ftyp box structure: [size(4)] [ftyp(4)] [brand(4)]
    // Brand is at bytes 8-11
    if (bytes.length < 12) return false;

    const brand = bytes.slice(8, 12).toLowerCase();
    return HEIC_SIGNATURES.some((sig) => brand.includes(sig));
  } catch {
    // If decoding fails, assume not HEIC
    return false;
  }
}

/**
 * Check if a file URI suggests HEIC format
 *
 * @param uri - File URI or path
 * @returns true if extension suggests HEIC format
 */
export function hasHEICExtension(uri: string): boolean {
  const lowerUri = uri.toLowerCase();
  return lowerUri.endsWith(".heic") || lowerUri.endsWith(".heif");
}

/**
 * Get appropriate MIME type for photo
 *
 * @param uri - File URI or path
 * @param base64Content - Optional base64 content for validation
 * @returns MIME type string
 */
export function getPhotoMimeType(uri: string, base64Content?: string): string {
  // Check extension first
  const lowerUri = uri.toLowerCase();

  if (lowerUri.endsWith(".heic") || lowerUri.endsWith(".heif")) {
    return "image/heic";
  }

  if (lowerUri.endsWith(".png")) {
    return "image/png";
  }

  // Default to JPEG for camera captures
  // expo-camera with skipProcessing: false returns JPEG
  return "image/jpeg";
}

/**
 * Determine if format conversion may be needed
 *
 * @param uri - File URI
 * @param targetFormat - Target format ("jpeg" | "png")
 * @returns true if conversion from HEIC may be needed
 */
export function needsFormatConversion(
  uri: string,
  targetFormat: "jpeg" | "png" = "jpeg"
): boolean {
  // Only iOS can produce HEIC
  if (Platform.OS !== "ios") {
    return false;
  }

  return hasHEICExtension(uri);
}

/**
 * Get file extension for MIME type
 *
 * @param mimeType - MIME type string
 * @returns File extension without dot
 */
export function getExtensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/heic":
    case "image/heif":
      return "heic";
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}

/**
 * Validate that photo is in acceptable format for evidence system
 *
 * @param mimeType - MIME type of the photo
 * @returns true if format is acceptable
 */
export function isAcceptableFormat(mimeType: string): boolean {
  const acceptable = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    // HEIC is acceptable but may need conversion for web/PDF
    "image/heic",
    "image/heif",
  ];

  return acceptable.includes(mimeType.toLowerCase());
}

/**
 * Log format info for debugging
 *
 * @param uri - File URI
 * @param mimeType - Detected MIME type
 */
export function logFormatInfo(uri: string, mimeType: string): void {
  if (__DEV__) {
    console.log(`[HEIC Utils] File: ${uri.split("/").pop()}`);
    console.log(`[HEIC Utils] MIME: ${mimeType}`);
    console.log(`[HEIC Utils] Platform: ${Platform.OS}`);
    console.log(`[HEIC Utils] Needs conversion: ${needsFormatConversion(uri)}`);
  }
}
