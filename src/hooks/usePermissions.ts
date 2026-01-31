/**
 * usePermissions Hook
 * Unified permission management for camera and location
 */

import { useState, useEffect, useCallback } from "react";
import * as Camera from "expo-camera";
import * as Location from "expo-location";
import { Platform, Linking } from "react-native";

export type PermissionStatus = "undetermined" | "granted" | "denied";

export interface PermissionState {
  camera: PermissionStatus;
  location: PermissionStatus;
  locationPrecise: boolean; // iOS 14+ can grant approximate vs precise
}

export interface UsePermissionsReturn {
  permissions: PermissionState;
  isLoading: boolean;
  allGranted: boolean;
  requestCameraPermission: () => Promise<boolean>;
  requestLocationPermission: () => Promise<boolean>;
  requestAllPermissions: () => Promise<boolean>;
  openSettings: () => void;
  refreshPermissions: () => Promise<void>;
}

/**
 * Map expo permission status to our PermissionStatus type
 */
function mapStatus(status: string): PermissionStatus {
  switch (status) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    default:
      return "undetermined";
  }
}

/**
 * Hook for managing camera and location permissions
 * Provides unified API for checking, requesting, and tracking permission state
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: "undetermined",
    location: "undetermined",
    locationPrecise: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Check current permission status
   */
  const checkPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cameraStatus, locationStatus] = await Promise.all([
        Camera.Camera.getCameraPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
      ]);

      // iOS 14+: check if user granted precise location
      // The accuracy property is available on iOS when location is granted
      let locationPrecise = true;
      if (Platform.OS === "ios" && locationStatus.status === "granted") {
        // expo-location returns accuracy: "full" | "reduced" on iOS 14+
        const fullStatus = locationStatus as { accuracy?: "full" | "reduced" };
        locationPrecise = fullStatus.accuracy === "full";
      }

      setPermissions({
        camera: mapStatus(cameraStatus.status),
        location: mapStatus(locationStatus.status),
        locationPrecise,
      });
    } catch (error) {
      console.error("Error checking permissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  /**
   * Request camera permission
   */
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Camera.Camera.requestCameraPermissionsAsync();
      const granted = status === "granted";
      setPermissions((prev) => ({
        ...prev,
        camera: granted ? "granted" : "denied",
      }));
      return granted;
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      return false;
    }
  }, []);

  /**
   * Request location permission
   * On iOS, also checks if we got precise location
   */
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";

      // On iOS, also check if we got precise location
      if (Platform.OS === "ios" && granted) {
        const fullStatus = await Location.getForegroundPermissionsAsync();
        const preciseStatus = fullStatus as { accuracy?: "full" | "reduced" };
        setPermissions((prev) => ({
          ...prev,
          location: "granted",
          locationPrecise: preciseStatus.accuracy === "full",
        }));
      } else {
        setPermissions((prev) => ({
          ...prev,
          location: granted ? "granted" : "denied",
          locationPrecise: granted, // Android always gives precise if granted
        }));
      }

      return granted;
    } catch (error) {
      console.error("Error requesting location permission:", error);
      return false;
    }
  }, []);

  /**
   * Request all permissions at once
   */
  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    const [camera, location] = await Promise.all([
      requestCameraPermission(),
      requestLocationPermission(),
    ]);
    return camera && location;
  }, [requestCameraPermission, requestLocationPermission]);

  /**
   * Open device settings so user can manually enable permissions
   */
  const openSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }, []);

  /**
   * Manually refresh permission state
   * Useful after returning from settings
   */
  const refreshPermissions = useCallback(async () => {
    await checkPermissions();
  }, [checkPermissions]);

  const allGranted =
    permissions.camera === "granted" && permissions.location === "granted";

  return {
    permissions,
    isLoading,
    allGranted,
    requestCameraPermission,
    requestLocationPermission,
    requestAllPermissions,
    openSettings,
    refreshPermissions,
  };
}

export default usePermissions;
