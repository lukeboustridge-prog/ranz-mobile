/**
 * Unit tests for location utilities.
 * Tests distance calculation and location validation functions.
 *
 * These are pure functions that don't require native module mocks.
 * Uses real NZ coordinates for meaningful test scenarios.
 */

import {
  calculateHaversineDistance,
  validateCaptureLocation,
  isApproximateLocation,
  formatGPSAccuracy,
  formatDistance,
  calculateBearing,
  bearingToCompass,
  type GPSCoordinates,
} from '../../lib/location-utils';

describe('Location Utilities', () => {
  describe('calculateHaversineDistance', () => {
    it('should calculate distance between Auckland CBD and Airport (~18km)', () => {
      // Auckland CBD
      const cbdLat = -36.8509;
      const cbdLng = 174.7645;
      // Auckland Airport
      const airportLat = -37.0082;
      const airportLng = 174.785;

      const distance = calculateHaversineDistance(cbdLat, cbdLng, airportLat, airportLng);

      // Should be approximately 17-18km
      expect(distance).toBeGreaterThan(17000);
      expect(distance).toBeLessThan(19000);
    });

    it('should return 0 for same point', () => {
      const distance = calculateHaversineDistance(-36.8509, 174.7645, -36.8509, 174.7645);

      expect(distance).toBe(0);
    });

    it('should handle antipodal points (~20,000km)', () => {
      // Points on opposite sides of Earth
      const distance = calculateHaversineDistance(0, 0, 0, 180);

      // Half Earth circumference
      expect(distance).toBeGreaterThan(19000000);
      expect(distance).toBeLessThan(21000000);
    });

    it('should calculate Wellington to Auckland (~490km)', () => {
      // Wellington
      const wellingtonLat = -41.2865;
      const wellingtonLng = 174.7762;
      // Auckland
      const aucklandLat = -36.8509;
      const aucklandLng = 174.7645;

      const distance = calculateHaversineDistance(
        wellingtonLat,
        wellingtonLng,
        aucklandLat,
        aucklandLng
      );

      // Should be approximately 490km
      expect(distance).toBeGreaterThan(480000);
      expect(distance).toBeLessThan(500000);
    });

    it('should be symmetric (A to B equals B to A)', () => {
      const distanceAB = calculateHaversineDistance(-36.8509, 174.7645, -37.0082, 174.785);
      const distanceBA = calculateHaversineDistance(-37.0082, 174.785, -36.8509, 174.7645);

      expect(distanceAB).toBeCloseTo(distanceBA, 5);
    });
  });

  describe('validateCaptureLocation', () => {
    const propertyLocation: GPSCoordinates = {
      latitude: -36.8509,
      longitude: 174.7645,
    };

    it('should return valid when within threshold', () => {
      // 100m away from property
      const captureLocation: GPSCoordinates = {
        latitude: -36.8519,
        longitude: 174.7645,
      };

      const result = validateCaptureLocation(captureLocation, propertyLocation, 500);

      expect(result.isValid).toBe(true);
      expect(result.distanceMeters).toBeLessThan(500);
      expect(result.message).toBe('Within expected range');
    });

    it('should return invalid when outside threshold', () => {
      // ~1km away from property
      const captureLocation: GPSCoordinates = {
        latitude: -36.86,
        longitude: 174.7645,
      };

      const result = validateCaptureLocation(captureLocation, propertyLocation, 500);

      expect(result.isValid).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(500);
      expect(result.message).toContain('m from property');
    });

    it('should handle no GPS signal (null capture location)', () => {
      const result = validateCaptureLocation(null, propertyLocation);

      expect(result.isValid).toBe(false);
      expect(result.distanceMeters).toBeNull();
      expect(result.message).toBe('No GPS signal');
    });

    it('should handle no property location', () => {
      const captureLocation: GPSCoordinates = {
        latitude: -36.8509,
        longitude: 174.7645,
      };

      const result = validateCaptureLocation(captureLocation, null);

      expect(result.isValid).toBe(true);
      expect(result.distanceMeters).toBeNull();
      expect(result.message).toBe('No property location to validate against');
    });

    it('should use default threshold of 500m', () => {
      // 400m away - should pass with default threshold
      const captureLocation: GPSCoordinates = {
        latitude: -36.8545,
        longitude: 174.7645,
      };

      const result = validateCaptureLocation(captureLocation, propertyLocation);

      expect(result.isValid).toBe(true);
    });
  });

  describe('isApproximateLocation', () => {
    it('should return false for accurate location (<= 1000m)', () => {
      expect(isApproximateLocation(50)).toBe(false);
      expect(isApproximateLocation(100)).toBe(false);
      expect(isApproximateLocation(500)).toBe(false);
      expect(isApproximateLocation(1000)).toBe(false);
    });

    it('should return true for approximate location (> 1000m)', () => {
      expect(isApproximateLocation(1001)).toBe(true);
      expect(isApproximateLocation(1500)).toBe(true);
      expect(isApproximateLocation(3000)).toBe(true);
      expect(isApproximateLocation(5000)).toBe(true);
    });
  });

  describe('formatGPSAccuracy', () => {
    it('should return Excellent for < 10m', () => {
      expect(formatGPSAccuracy(5)).toBe('Excellent');
      expect(formatGPSAccuracy(9.9)).toBe('Excellent');
    });

    it('should return Good for 10-30m', () => {
      expect(formatGPSAccuracy(10)).toBe('Good');
      expect(formatGPSAccuracy(25)).toBe('Good');
      expect(formatGPSAccuracy(29.9)).toBe('Good');
    });

    it('should return Fair for 30-100m', () => {
      expect(formatGPSAccuracy(30)).toBe('Fair');
      expect(formatGPSAccuracy(75)).toBe('Fair');
      expect(formatGPSAccuracy(99)).toBe('Fair');
    });

    it('should return Poor for 100-1000m', () => {
      expect(formatGPSAccuracy(100)).toBe('Poor');
      expect(formatGPSAccuracy(500)).toBe('Poor');
      expect(formatGPSAccuracy(1000)).toBe('Poor');
    });

    it('should return Approximate only for > 1000m', () => {
      expect(formatGPSAccuracy(1001)).toBe('Approximate only');
      expect(formatGPSAccuracy(5000)).toBe('Approximate only');
    });
  });

  describe('formatDistance', () => {
    it('should format meters for distances < 1km', () => {
      expect(formatDistance(50)).toBe('50m');
      expect(formatDistance(150)).toBe('150m');
      expect(formatDistance(999)).toBe('999m');
    });

    it('should format kilometers for distances >= 1km', () => {
      expect(formatDistance(1000)).toBe('1.0km');
      expect(formatDistance(1500)).toBe('1.5km');
      expect(formatDistance(10000)).toBe('10.0km');
    });

    it('should round meters to whole numbers', () => {
      expect(formatDistance(150.7)).toBe('151m');
      expect(formatDistance(150.3)).toBe('150m');
    });

    it('should format kilometers to one decimal place', () => {
      expect(formatDistance(1234)).toBe('1.2km');
      expect(formatDistance(1256)).toBe('1.3km');
    });
  });

  describe('calculateBearing', () => {
    it('should return 0 for due north', () => {
      // Point directly north
      const bearing = calculateBearing(-37, 174, -36, 174);

      expect(bearing).toBeCloseTo(0, 0);
    });

    it('should return ~90 for due east', () => {
      // Point directly east
      const bearing = calculateBearing(-36, 174, -36, 175);

      expect(bearing).toBeCloseTo(90, 0);
    });

    it('should return ~180 for due south', () => {
      // Point directly south
      const bearing = calculateBearing(-36, 174, -37, 174);

      expect(bearing).toBeCloseTo(180, 0);
    });

    it('should return ~270 for due west', () => {
      // Point directly west
      const bearing = calculateBearing(-36, 175, -36, 174);

      expect(bearing).toBeCloseTo(270, 0);
    });

    it('should return normalized bearing (0-360)', () => {
      const bearing = calculateBearing(0, 0, 0, -1);

      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  describe('bearingToCompass', () => {
    it('should return N for 0 degrees', () => {
      expect(bearingToCompass(0)).toBe('N');
      expect(bearingToCompass(22)).toBe('N');
    });

    it('should return NE for 45 degrees', () => {
      expect(bearingToCompass(45)).toBe('NE');
      expect(bearingToCompass(67)).toBe('NE');
    });

    it('should return E for 90 degrees', () => {
      expect(bearingToCompass(90)).toBe('E');
    });

    it('should return SE for 135 degrees', () => {
      expect(bearingToCompass(135)).toBe('SE');
    });

    it('should return S for 180 degrees', () => {
      expect(bearingToCompass(180)).toBe('S');
    });

    it('should return SW for 225 degrees', () => {
      expect(bearingToCompass(225)).toBe('SW');
    });

    it('should return W for 270 degrees', () => {
      expect(bearingToCompass(270)).toBe('W');
    });

    it('should return NW for 315 degrees', () => {
      expect(bearingToCompass(315)).toBe('NW');
    });

    it('should wrap around for 360 degrees', () => {
      expect(bearingToCompass(360)).toBe('N');
    });
  });
});
