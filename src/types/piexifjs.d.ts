/**
 * Type declarations for piexifjs
 *
 * piexifjs is a pure JavaScript library for reading/writing EXIF metadata.
 * This declaration provides type safety for our GPS embedding operations.
 */

declare module "piexifjs" {
  /**
   * EXIF IFD (Image File Directory) structure
   */
  export interface ExifObject {
    "0th": Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    Interop: Record<number, unknown>;
    "1st": Record<number, unknown>;
    thumbnail: string | null;
  }

  /**
   * GPS IFD tag constants
   */
  export const GPSIFD: {
    GPSVersionID: number;
    GPSLatitudeRef: number;
    GPSLatitude: number;
    GPSLongitudeRef: number;
    GPSLongitude: number;
    GPSAltitudeRef: number;
    GPSAltitude: number;
    GPSTimeStamp: number;
    GPSSatellites: number;
    GPSStatus: number;
    GPSMeasureMode: number;
    GPSDOP: number;
    GPSSpeedRef: number;
    GPSSpeed: number;
    GPSTrackRef: number;
    GPSTrack: number;
    GPSImgDirectionRef: number;
    GPSImgDirection: number;
    GPSMapDatum: number;
    GPSDestLatitudeRef: number;
    GPSDestLatitude: number;
    GPSDestLongitudeRef: number;
    GPSDestLongitude: number;
    GPSDestBearingRef: number;
    GPSDestBearing: number;
    GPSDestDistanceRef: number;
    GPSDestDistance: number;
    GPSProcessingMethod: number;
    GPSAreaInformation: number;
    GPSDateStamp: number;
    GPSDifferential: number;
    GPSHPositioningError: number;
  };

  /**
   * Load EXIF data from a base64 data URI
   * @param dataUri - Base64 encoded image with data:image/jpeg;base64, prefix
   * @returns Parsed EXIF object
   */
  export function load(dataUri: string): ExifObject;

  /**
   * Convert EXIF object to binary format
   * @param exifObj - EXIF object structure
   * @returns Binary EXIF data as string
   */
  export function dump(exifObj: ExifObject): string;

  /**
   * Insert EXIF binary data into image
   * @param exifBytes - Binary EXIF data from dump()
   * @param dataUri - Base64 encoded image
   * @returns New data URI with embedded EXIF
   */
  export function insert(exifBytes: string, dataUri: string): string;

  /**
   * Remove EXIF data from image
   * @param dataUri - Base64 encoded image
   * @returns Image data URI without EXIF
   */
  export function remove(dataUri: string): string;

  const piexif: {
    load: typeof load;
    dump: typeof dump;
    insert: typeof insert;
    remove: typeof remove;
    GPSIFD: typeof GPSIFD;
    ExifObject: ExifObject;
  };

  export default piexif;
}
