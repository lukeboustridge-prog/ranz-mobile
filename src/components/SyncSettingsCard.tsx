/**
 * SyncSettingsCard Component
 * UI for configuring sync preferences
 */

import React from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useSyncSettings } from "../hooks/useSyncSettings";

interface SyncSettingsCardProps {
  onClose?: () => void;
}

export function SyncSettingsCard({ onClose }: SyncSettingsCardProps) {
  const {
    settings,
    isLoading,
    isWifi,
    connectionType,
    updateSettings,
    resetSettings,
  } = useSyncSettings();

  if (isLoading || !settings) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const handleTogglePhotosWifiOnly = async () => {
    await updateSettings({ photosWifiOnly: !settings.photosWifiOnly });
  };

  const handleToggleAutoSync = async () => {
    await updateSettings({ autoSyncEnabled: !settings.autoSyncEnabled });
  };

  const handleToggleBackgroundSync = async () => {
    await updateSettings({ backgroundSyncEnabled: !settings.backgroundSyncEnabled });
  };

  const handleReset = async () => {
    await resetSettings();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Settings</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Current connection status */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, isWifi ? styles.wifiDot : styles.cellularDot]} />
        <Text style={styles.statusText}>
          {isWifi ? "Connected via WiFi" : `Connected via ${connectionType || "Mobile"}`}
        </Text>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upload Preferences</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Large photos over WiFi only</Text>
            <Text style={styles.settingDescription}>
              Photos over {settings.wifiOnlyThresholdMb}MB will wait for WiFi
            </Text>
          </View>
          <Switch
            value={settings.photosWifiOnly}
            onValueChange={handleTogglePhotosWifiOnly}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={settings.photosWifiOnly ? "#3c4b5d" : "#f4f4f5"}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Behavior</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-sync when online</Text>
            <Text style={styles.settingDescription}>
              Automatically sync when connected
            </Text>
          </View>
          <Switch
            value={settings.autoSyncEnabled}
            onValueChange={handleToggleAutoSync}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={settings.autoSyncEnabled ? "#3c4b5d" : "#f4f4f5"}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Background sync</Text>
            <Text style={styles.settingDescription}>
              Sync data when app is in background
            </Text>
          </View>
          <Switch
            value={settings.backgroundSyncEnabled}
            onValueChange={handleToggleBackgroundSync}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={settings.backgroundSyncEnabled ? "#3c4b5d" : "#f4f4f5"}
          />
        </View>
      </View>

      {/* Reset button */}
      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </TouchableOpacity>

      {/* Info text */}
      <Text style={styles.infoText}>
        These settings help manage your data usage when working in the field.
        Large photos will automatically sync when you connect to WiFi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  closeButton: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3c4b5d",
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    padding: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  wifiDot: {
    backgroundColor: "#22c55e",
  },
  cellularDot: {
    backgroundColor: "#f59e0b",
  },
  statusText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  settingDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: "#6b7280",
  },
  infoText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});

export default SyncSettingsCard;
