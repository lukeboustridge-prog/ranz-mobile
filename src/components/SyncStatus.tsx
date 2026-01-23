/**
 * SyncStatus Component
 * Displays sync status badge and triggers manual sync
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSyncEngine } from "../hooks/useSyncEngine";

interface SyncStatusProps {
  showLabel?: boolean;
  size?: "small" | "medium";
}

export function SyncStatus({ showLabel = true, size = "medium" }: SyncStatusProps) {
  const { syncState, progress, sync } = useSyncEngine();

  const handlePress = () => {
    if (!syncState.isSyncing) {
      sync();
    }
  };

  const getStatusColor = () => {
    if (!syncState.isOnline) return "#ef4444"; // Red - offline
    if (syncState.isSyncing) return "#3b82f6"; // Blue - syncing
    if (syncState.pendingUploads > 0) return "#f59e0b"; // Amber - pending
    return "#22c55e"; // Green - synced
  };

  const getStatusText = () => {
    if (!syncState.isOnline) return "Offline";
    if (syncState.isSyncing) return progress?.status || "Syncing...";
    if (syncState.pendingUploads > 0) return `${syncState.pendingUploads} pending`;
    return "Synced";
  };

  const isSmall = size === "small";

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSmall && styles.containerSmall,
        { backgroundColor: getStatusColor() + "20" },
      ]}
      onPress={handlePress}
      disabled={syncState.isSyncing}
    >
      {syncState.isSyncing ? (
        <ActivityIndicator size="small" color={getStatusColor()} />
      ) : (
        <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      )}
      {showLabel && (
        <Text
          style={[
            styles.label,
            isSmall && styles.labelSmall,
            { color: getStatusColor() },
          ]}
        >
          {getStatusText()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  containerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  labelSmall: {
    fontSize: 10,
  },
});

export default SyncStatus;
