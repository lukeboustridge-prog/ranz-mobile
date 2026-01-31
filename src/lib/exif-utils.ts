/**
 * EXIF Utilities
 * GPS EXIF embedding and extraction for evidence photos
 *
 * This module enables photos to contain GPS coordinates in EXIF metadata,
 * making location data readable by external tools (courts, experts, etc.).
 *
 * CRITICAL: GPS embedding creates a NEW file. The original file with its
 * hash must be preserved separately in the immutable originals directory.
 *
 * Dual-hash strategy:
 * 1. Hash the original BEFORE any EXIF modification
 * 2. Create a working copy with embedded GPS
 * 3. Store both files (original for integrity, working for display/export)
 */

import piexif from "piexifjs";

/**
 * GPS coordinates for embedding in EXIF
 */
export interface GPSData {
  /** Latitude in decimal degrees (negative for South) */
  lat: number;
  /** Longitude in decimal degrees (negative for West) */
  lng: number;
  /** Altitude in meters above sea level (optional) */
  altitude?: number;
  /** Timestamp when GPS reading was taken (optional) */
  timestamp?: Date;
}

/**
 * Extracted GPS data from EXIF
 */
export interface ExtractedGPS {
  /** Latitude in decimal degrees */
  lat: number | null;
  /** Longitude in decimal degrees */
  lng: number | null;
  /** Altitude in meters */
  altitude: number | null;
  /** Whether GPS data was found in EXIF */
  hasGPS: boolean;
}

/**
 * EXIF rational value format: [numerator, denominator]
 */
type Rational = [number, number];

/**
 * DMS (Degrees, Minutes, Seconds) in EXIF rational format
 * Each component is [value, denominator]
 */
type DMSRational = [Rational, Rational, Rational];

/**
 * Convert decimal degrees to EXIF DMS rational format
 *
 * EXIF stores GPS coordinates as three rational values:
 * - Degrees: [[d, 1]]
 * - Minutes: [[m, 1]]
 * - Seconds: [[s*10000, 10000]] for sub-second precision
 *
 * @param deg - Decimal degrees (positive value, sign is handled by ref)
 * @returns DMS as array of rational pairs
 *
 * @example
 * ```typescript
 * // Auckland: -36.8485
 * const dms = degToDmsRational(-36.8485);
 * // Returns: [[36, 1], [50, 1], [5546400, 10000]]
 * // = 36 degrees, 50 minutes, 55.464 seconds
 * ```
 */
export function degToDmsRational(deg: number): DMSRational {
  const absDeg = Math.abs(deg);
  const d = Math.floor(absDeg);
  const minFloat = (absDeg - d) * 60;
  const m = Math.floor(minFloat);
  const secFloat = (minFloat - m) * 60;
  // Use rational format: [numerator, denominator] for precision
  // Multiply by 10000 for sub-second precision
  const s = Math.round(secFloat * 10000);
  return [
    [d, 1],
    [m, 1],
    [s, 10000],
  ];
}

/**
 * Convert DMS rational format back to decimal degrees
 *
 * @param dms - DMS as array of rational pairs
 * @param ref - Reference direction ('N', 'S', 'E', 'W')
 * @returns Decimal degrees (negative for S or W)
 */
function dmsRationalToDeg(dms: DMSRational, ref: string): number {
  const [dRat, mRat, sRat] = dms;
  const degrees = dRat[0] / dRat[1];
  const minutes = mRat[0] / mRat[1];
  const seconds = sRat[0] / sRat[1];
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

/**
 * Embed GPS data into JPEG EXIF metadata
 *
 * This function creates a NEW JPEG with GPS coordinates embedded in EXIF.
 * The original base64 content is NOT modified.
 *
 * CRITICAL: Always hash the original BEFORE calling this function,
 * as the returned content will have a different hash.
 *
 * @param base64Jpeg - Original JPEG as base64 string (without data URI prefix)
 * @param gps - GPS coordinates to embed
 * @returns New base64 JPEG with embedded GPS data
 * @throws Error if EXIF manipulation fails
 *
 * @example
 * ```typescript
 * // Hash original first!
 * const originalHash = await generateHashFromBase64(originalBase64);
 *
 * // Then embed GPS
 * const gpsBase64 = embedGPSInEXIF(originalBase64, {
 *   lat: -36.8485,
 *   lng: 174.7633,
 *   altitude: 50,
 *   timestamp: new Date(),
 * });
 * ```
 */
export function embedGPSInEXIF(base64Jpeg: string, gps: GPSData): string {
  // Add data URI prefix if not present (piexifjs requires it)
  const dataUri = base64Jpeg.startsWith("data:image/jpeg")
    ? base64Jpeg
    : `data:image/jpeg;base64,${base64Jpeg}`;

  // Load existing EXIF or create empty structure
  let exifObj: piexif.ExifObject;
  try {
    exifObj = piexif.load(dataUri);
  } catch {
    // No existing EXIF, create empty structure
    exifObj = {
      "0th": {},
      Exif: {},
      GPS: {},
      Interop: {},
      "1st": {},
      thumbnail: null,
    };
  }

  // Ensure GPS IFD exists
  if (!exifObj.GPS) {
    exifObj.GPS = {};
  }

  // Set GPS latitude
  exifObj.GPS[piexif.GPSIFD.GPSLatitude] = degToDmsRational(gps.lat);
  exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] = gps.lat >= 0 ? "N" : "S";

  // Set GPS longitude
  exifObj.GPS[piexif.GPSIFD.GPSLongitude] = degToDmsRational(gps.lng);
  exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] = gps.lng >= 0 ? "E" : "W";

  // Set altitude if provided
  if (gps.altitude !== undefined) {
    // Altitude is a single rational: [meters*100, 100] for cm precision
    const altValue = Math.abs(Math.round(gps.altitude * 100));
    exifObj.GPS[piexif.GPSIFD.GPSAltitude] = [altValue, 100];
    // AltitudeRef: 0 = above sea level, 1 = below sea level
    exifObj.GPS[piexif.GPSIFD.GPSAltitudeRef] = gps.altitude >= 0 ? 0 : 1;
  }

  // Set GPS timestamp if provided
  if (gps.timestamp) {
    const date = gps.timestamp;
    // GPSDateStamp: YYYY:MM:DD format
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    exifObj.GPS[piexif.GPSIFD.GPSDateStamp] = `${year}:${month}:${day}`;

    // GPSTimeStamp: [hour, minute, second] as rationals
    exifObj.GPS[piexif.GPSIFD.GPSTimeStamp] = [
      [date.getUTCHours(), 1],
      [date.getUTCMinutes(), 1],
      [date.getUTCSeconds(), 1],
    ];
  }

  // Convert EXIF to binary and insert into image
  const exifBytes = piexif.dump(exifObj);
  const newDataUri = piexif.insert(exifBytes, dataUri);

  // Return base64 without data URI prefix
  return newDataUri.replace(/^data:image\/jpeg;base64,/, "");
}

/**
 * Extract GPS data from JPEG EXIF metadata
 *
 * Use this to verify GPS was correctly embedded or to read
 * GPS from photos taken with the device camera.
 *
 * @param base64Jpeg - JPEG as base64 string (with or without data URI prefix)
 * @returns Extracted GPS data or null values if not present
 *
 * @example
 * ```typescript
 * const gps = extractGPSFromEXIF(photoBase64);
 * if (gps.hasGPS) {
 *   console.log(`Photo taken at: ${gps.lat}, ${gps.lng}`);
 * } else {
 *   console.log('No GPS data in photo');
 * }
 * ```
 */
export function extractGPSFromEXIF(base64Jpeg: string): ExtractedGPS {
  const result: ExtractedGPS = {
    lat: null,
    lng: null,
    altitude: null,
    hasGPS: false,
  };

  try {
    // Add data URI prefix if not present
    const dataUri = base64Jpeg.startsWith("data:image/jpeg")
      ? base64Jpeg
      : `data:image/jpeg;base64,${base64Jpeg}`;

    const exifObj = piexif.load(dataUri);

    if (!exifObj.GPS) {
      return result;
    }

    // Extract latitude
    const latValue = exifObj.GPS[piexif.GPSIFD.GPSLatitude];
    const latRef = exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef];
    if (latValue && latRef) {
      result.lat = dmsRationalToDeg(latValue as DMSRational, latRef as string);
      result.hasGPS = true;
    }

    // Extract longitude
    const lngValue = exifObj.GPS[piexif.GPSIFD.GPSLongitude];
    const lngRef = exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef];
    if (lngValue && lngRef) {
      result.lng = dmsRationalToDeg(lngValue as DMSRational, lngRef as string);
      result.hasGPS = true;
    }

    // Extract altitude
    const altValue = exifObj.GPS[piexif.GPSIFD.GPSAltitude];
    const altRef = exifObj.GPS[piexif.GPSIFD.GPSAltitudeRef];
    if (altValue) {
      const [num, den] = altValue as Rational;
      const alt = num / den;
      // AltitudeRef: 0 = above sea level, 1 = below
      result.altitude = altRef === 1 ? -alt : alt;
    }
  } catch {
    // Failed to parse EXIF - return empty result
    return result;
  }

  return result;
}
