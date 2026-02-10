/**
 * PermissionGate Component
 * Wraps camera UI and handles permission request flow
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import { usePermissions, PermissionStatus } from "../hooks/usePermissions";

interface PermissionGateProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * PermissionGate wraps camera-requiring UI and handles the permission request flow.
 * Shows appropriate UI for undetermined, granted, and denied permission states.
 * Automatically refreshes permissions when app returns from settings.
 */
export function PermissionGate({ children, onClose }: PermissionGateProps) {
  const {
    permissions,
    isLoading,
    allGranted,
    requestAllPermissions,
    openSettings,
    refreshPermissions,
  } = usePermissions();

  // Refresh permissions when app returns from background (e.g., after visiting settings)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        refreshPermissions();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [refreshPermissions]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3c4b5d" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </SafeAreaView>
    );
  }

  if (allGranted) {
    return <>{children}</>;
  }

  const anyDenied =
    permissions.camera === "denied" || permissions.location === "denied";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Camera Access Required</Text>

        <Text style={styles.description}>
          To capture inspection photos with GPS data for evidence integrity,
          we need access to your camera and location.
        </Text>

        <View style={styles.permissionList}>
          <PermissionItem
            label="Camera"
            status={permissions.camera}
            reason="To capture inspection photos"
          />
          <PermissionItem
            label="Location"
            status={permissions.location}
            reason="To record GPS coordinates in photos"
          />
          {permissions.location === "granted" && !permissions.locationPrecise && (
            <View style={styles.precisionWarning}>
              <Text style={styles.precisionWarningText}>
                Approximate location only. For accurate evidence, enable precise
                location in Settings.
              </Text>
            </View>
          )}
        </View>

        {anyDenied ? (
          <View style={styles.deniedSection}>
            <Text style={styles.deniedText}>
              Permissions were denied. Please enable them in your device settings.
            </Text>
            <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.grantButton}
            onPress={requestAllPermissions}
          >
            <Text style={styles.grantButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
        )}

        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

interface PermissionItemProps {
  label: string;
  status: PermissionStatus;
  reason: string;
}

function PermissionItem({ label, status, reason }: PermissionItemProps) {
  const statusIcon = {
    undetermined: "○",
    granted: "✓",
    denied: "✗",
  };

  const statusColor = {
    undetermined: "#6b7280",
    granted: "#22c55e",
    denied: "#ef4444",
  };

  return (
    <View style={styles.permissionItem}>
      <Text style={[styles.statusIcon, { color: statusColor[status] }]}>
        {statusIcon[status]}
      </Text>
      <View style={styles.permissionInfo}>
        <Text style={styles.permissionLabel}>{label}</Text>
        <Text style={styles.permissionReason}>{reason}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c1929",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 400,
    width: "100%",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    color: "#a3bed9",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionList: {
    marginBottom: 32,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusIcon: {
    fontSize: 20,
    fontWeight: "700",
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  permissionReason: {
    color: "#a3bed9",
    fontSize: 14,
    marginTop: 2,
  },
  precisionWarning: {
    backgroundColor: "rgba(245,158,11,0.15)",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  precisionWarningText: {
    color: "#f59e0b",
    fontSize: 13,
    lineHeight: 18,
  },
  deniedSection: {
    alignItems: "center",
  },
  deniedText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  settingsButton: {
    backgroundColor: "#3c4b5d",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  settingsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  grantButton: {
    backgroundColor: "#3c4b5d",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: "center",
  },
  grantButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#a3bed9",
    fontSize: 16,
  },
});

export default PermissionGate;
