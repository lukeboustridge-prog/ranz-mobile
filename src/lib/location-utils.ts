/**
 * Location Utilities
 * GPS distance calculation and location validation for evidence capture
 *
 * This module provides:
 * - Haversine distance calculation between GPS coordinates
 * - Validation that photos were taken near the expected property location
 * - Detection of iOS approximate location (user denied precise location)
 * - Human-readable GPS accuracy formatting
 *
 * Used to ensure photos are captured on-site and to alert users when
 * GPS accuracy is poor (which may affect evidence quality).
 */

/**
 * GPS coordinates
 */
export interface GPSCoordinates {
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
}

/**
 * Result of location validation
 */
export interface LocationValidationResult {
  /** Whether the capture location is within acceptable range */
  isValid: boolean;
  /** Distance from property in meters (null if either location unavailable) */
  distanceMeters: number | null;
  /** Human-readable validation message */
  message: string;
}

/**
 * GPS accuracy quality levels
 */
export type GPSAccuracyLevel =
  | "Excellent"
  | "Good"
  | "Fair"
  | "Poor"
  | "Approximate only";

/**
 * Earth radius in meters (WGS84 mean radius)
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate the Haversine distance between two GPS coordinates
 *
 * The Haversine formula determines the great-circle distance between
 * two points on a sphere given their latitudes and longitudes.
 *
 * @param lat1 - Latitude of first point in decimal degrees
 * @param lng1 - Longitude of first point in decimal degrees
 * @param lat2 - Latitude of second point in decimal degrees
 * @param lng2 - Longitude of second point in decimal degrees
 * @returns Distance in meters
 *
 * @example
 * ```typescript
 * // Auckland CBD to Auckland Domain (~1.5km)
 * const distance = calculateHaversineDistance(
 *   -36.8485, 174.7633,  // CBD
 *   -36.8608, 174.7780   // Domain
 * );
 * console.log(`Distance: ${distance}m`); // ~1500m
 * ```
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Handle edge case: same point
  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }

  // Convert to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lng2 - lng1);

  // Haversine formula
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Validate that a photo capture location is near the expected property location
 *
 * This function checks if the inspector is on-site when capturing evidence.
 * A threshold of 500m is used by default, which accounts for:
 * - GPS accuracy variations
 * - Large property boundaries
 * - Inspector positioning (e.g., across the street)
 *
 * @param captureLocation - GPS coordinates where photo was captured (null if unavailable)
 * @param propertyLocation - Expected property GPS coordinates (null if not set)
 * @param thresholdMeters - Maximum allowed distance (default: 500m)
 * @returns Validation result with status, distance, and message
 *
 * @example
 * ```typescript
 * const result = validateCaptureLocation(
 *   { latitude: -36.8485, longitude: 174.7633 },  // Capture location
 *   { latitude: -36.8490, longitude: 174.7640 },  // Property location
 *   500  // 500m threshold
 * );
 *
 * if (!result.isValid) {
 *   console.warn(result.message);
 *   // "Capture location is 450m from property"
 * }
 * ```
 */
export function validateCaptureLocation(
  captureLocation: GPSCoordinates | null | undefined,
  propertyLocation: GPSCoordinates | null | undefined,
  thresholdMeters: number = 500
): LocationValidationResult {
  // No GPS signal on device
  if (!captureLocation) {
    return {
      isValid: false,
      distanceMeters: null,
      message: "No GPS signal",
    };
  }

  // No property location to validate against
  if (!propertyLocation) {
    return {
      isValid: true,
      distanceMeters: null,
      message: "No property location to validate against",
    };
  }

  // Calculate distance
  const distance = calculateHaversineDistance(
    captureLocation.latitude,
    captureLocation.longitude,
    propertyLocation.latitude,
    propertyLocation.longitude
  );

  const roundedDistance = Math.round(distance);

  // Check if within threshold
  if (distance <= thresholdMeters) {
    return {
      isValid: true,
      distanceMeters: roundedDistance,
      message: "Within expected range",
    };
  }

  // Outside threshold
  return {
    isValid: false,
    distanceMeters: roundedDistance,
    message: `Capture location is ${roundedDistance}m from property`,
  };
}

/**
 * Detect if the device is providing iOS approximate location
 *
 * When users deny "Precise Location" on iOS, the system provides
 * a randomized location within approximately 10km of the actual position.
 * This manifests as very low accuracy readings (>1000m).
 *
 * For forensic evidence, precise location is essential. This function
 * helps detect when the user should be prompted to enable precise location.
 *
 * @param accuracy - GPS accuracy in meters from location API
 * @returns true if accuracy suggests approximate location only
 *
 * @example
 * ```typescript
 * const location = await getCurrentLocation();
 * if (isApproximateLocation(location.accuracy)) {
 *   Alert.alert(
 *     'Precise Location Required',
 *     'Please enable precise location in Settings for evidence capture.'
 *   );
 * }
 * ```
 */
export function isApproximateLocation(accuracy: number): boolean {
  // iOS approximate location typically has accuracy >1000m
  // (often 3000-5000m due to the randomization)
  return accuracy > 1000;
}

/**
 * Format GPS accuracy as a human-readable quality level
 *
 * Accuracy values from mobile GPS:
 * - < 10m: Modern device with clear sky view
 * - 10-30m: Typical urban conditions
 * - 30-100m: Indoor or obstructed view
 * - 100-1000m: Poor signal or assisted GPS only
 * - > 1000m: iOS approximate location or cellular-only
 *
 * @param accuracy - GPS accuracy in meters
 * @returns Human-readable quality level
 *
 * @example
 * ```typescript
 * const quality = formatGPSAccuracy(15);
 * console.log(quality); // "Good"
 * ```
 */
export function formatGPSAccuracy(accuracy: number): GPSAccuracyLevel {
  if (accuracy < 10) {
    return "Excellent";
  }
  if (accuracy < 30) {
    return "Good";
  }
  if (accuracy < 100) {
    return "Fair";
  }
  if (accuracy <= 1000) {
    return "Poor";
  }
  return "Approximate only";
}

/**
 * Format distance for display
 *
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "150m", "1.5km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Calculate bearing between two points
 *
 * Useful for indicating direction to property from current location.
 *
 * @param lat1 - Latitude of starting point
 * @param lng1 - Longitude of starting point
 * @param lat2 - Latitude of destination point
 * @param lng2 - Longitude of destination point
 * @returns Bearing in degrees (0-360, where 0=North, 90=East, etc.)
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const bearing = toDeg(Math.atan2(y, x));

  // Normalize to 0-360
  return (bearing + 360) % 360;
}

/**
 * Convert bearing to compass direction
 *
 * @param bearing - Bearing in degrees (0-360)
 * @returns Compass direction (N, NE, E, SE, S, SW, W, NW)
 */
export function bearingToCompass(
  bearing: number
): "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}
