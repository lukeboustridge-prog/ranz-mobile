/**
 * SyncStatus Component
 * Enhanced sync status display with detailed info and retry capabilities
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Pressable,
} from "react-native";
import { useSyncStatus } from "../hooks/useSyncStatus";

interface SyncStatusProps {
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
  expandable?: boolean;
}

export function SyncStatus({
  showLabel = true,
  size = "medium",
  expandable = true,
}: SyncStatusProps) {
  const {
    syncState,
    backgroundStatus,
    isSyncing,
    error,
    progress,
    progressMessage,
    detailedProgress,
    sync,
    retryFailed,
  } = useSyncStatus();

  const [isExpanded, setIsExpanded] = useState(false);

  const handlePress = () => {
    if (expandable && !isSyncing) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSync = async () => {
    try {
      await sync();
    } catch {
      // Error handled by hook
    }
  };

  const handleRetry = async () => {
    try {
      await retryFailed();
    } catch {
      // Error handled by hook
    }
  };

  const getStatusColor = () => {
    if (!syncState?.isOnline) return "#ef4444"; // Red - offline
    if (isSyncing) return "#3b82f6"; // Blue - syncing
    if (error) return "#f59e0b"; // Amber - error
    if ((syncState?.pendingUploads ?? 0) > 0) return "#f59e0b"; // Amber - pending
    return "#22c55e"; // Green - synced
  };

  const getStatusText = () => {
    if (!syncState?.isOnline) return "Offline";
    if (isSyncing) {
      // Use detailed progress for richer display
      if (detailedProgress && detailedProgress.totalItems > 0) {
        if (detailedProgress.phase === 'uploading_reports') {
          return `Uploading report ${detailedProgress.currentItem} of ${detailedProgress.totalItems}`;
        }
        if (detailedProgress.phase === 'uploading_photos') {
          return `Uploading photo ${detailedProgress.currentItem} of ${detailedProgress.totalItems}`;
        }
        if (detailedProgress.phase === 'downloading') {
          return `Downloading ${detailedProgress.itemType}s...`;
        }
      }
      // Fall back to percentage display
      return progressMessage || `Syncing... ${Math.round(progress)}%`;
    }
    if (error) return "Sync Error";
    if ((syncState?.pendingUploads ?? 0) > 0) {
      return `${syncState.pendingUploads} pending`;
    }
    return "Synced";
  };

  const getLastSyncText = () => {
    if (!syncState?.lastSyncAt) return "Never synced";

    const lastSync = new Date(syncState.lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const statusColor = getStatusColor();
  const isSmall = size === "small";
  const isLarge = size === "large";

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[
          styles.container,
          isSmall && styles.containerSmall,
          isLarge && styles.containerLarge,
          { backgroundColor: statusColor + "15", borderColor: statusColor + "30" },
        ]}
        onPress={handlePress}
        disabled={isSyncing}
      >
        <View style={styles.mainRow}>
          {isSyncing ? (
            <ActivityIndicator size="small" color={statusColor} />
          ) : (
            <View
              style={[
                styles.dot,
                isSmall && styles.dotSmall,
                { backgroundColor: statusColor },
              ]}
            />
          )}

          {showLabel && (
            <View style={styles.labelContainer}>
              <Text
                style={[
                  styles.label,
                  isSmall && styles.labelSmall,
                  isLarge && styles.labelLarge,
                  { color: statusColor },
                ]}
              >
                {getStatusText()}
              </Text>

              {!isSmall && !isSyncing && (
                <Text style={styles.lastSync}>{getLastSyncText()}</Text>
              )}
              {isSyncing && detailedProgress && detailedProgress.totalItems > 0 && !isSmall && (
                <Text style={styles.itemCount}>
                  {detailedProgress.currentItem} of {detailedProgress.totalItems} {detailedProgress.itemType}s
                </Text>
              )}
            </View>
          )}

          {expandable && !isSmall && (
            <Text style={[styles.chevron, { color: statusColor }]}>
              {isExpanded ? "▲" : "▼"}
            </Text>
          )}
        </View>

        {/* Progress bar when syncing */}
        {isSyncing && progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${progress}%`, backgroundColor: statusColor },
                ]}
              />
            </View>
          </View>
        )}
      </Pressable>

      {/* Expanded details */}
      {isExpanded && !isSmall && (
        <View style={[styles.expandedContainer, { borderColor: statusColor + "30" }]}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={[styles.detailValue, { color: statusColor }]}>
              {syncState?.isOnline ? "Online" : "Offline"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pending uploads</Text>
            <Text style={styles.detailValue}>
              {syncState?.pendingUploads ?? 0}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last sync</Text>
            <Text style={styles.detailValue}>
              {syncState?.lastSyncAt
                ? new Date(syncState.lastSyncAt).toLocaleString()
                : "Never"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Background sync</Text>
            <Text style={[
              styles.detailValue,
              { color: backgroundStatus?.isRegistered ? '#22c55e' : '#6b7280' }
            ]}>
              {backgroundStatus?.isRegistered ? 'Active' : 'Inactive'}
            </Text>
          </View>

          {backgroundStatus?.lastRunAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last background sync</Text>
              <Text style={styles.detailValue}>
                {new Date(backgroundStatus.lastRunAt).toLocaleString()}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorLabel}>Last error</Text>
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.syncButton]}
              onPress={handleSync}
              disabled={isSyncing || !syncState?.isOnline}
            >
              <Text style={styles.buttonText}>
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Text>
            </TouchableOpacity>

            {error && (
              <TouchableOpacity
                style={[styles.button, styles.retryButton]}
                onPress={handleRetry}
                disabled={isSyncing || !syncState?.isOnline}
              >
                <Text style={styles.retryButtonText}>Retry Failed</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Compact sync indicator for headers/nav bars
 */
export function SyncIndicator() {
  const { syncState, isSyncing } = useSyncStatus();

  const getColor = () => {
    if (!syncState?.isOnline) return "#ef4444";
    if (isSyncing) return "#3b82f6";
    if ((syncState?.pendingUploads ?? 0) > 0) return "#f59e0b";
    return "#22c55e";
  };

  return (
    <View style={styles.indicator}>
      {isSyncing ? (
        <ActivityIndicator size={12} color={getColor()} />
      ) : (
        <View style={[styles.indicatorDot, { backgroundColor: getColor() }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  container: {
    flexDirection: "column",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  containerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  containerLarge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelSmall: {
    fontSize: 11,
  },
  labelLarge: {
    fontSize: 15,
  },
  lastSync: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  itemCount: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  chevron: {
    fontSize: 10,
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  expandedContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111827",
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#7f1d1d",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  syncButton: {
    backgroundColor: "#2d5c8f",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  retryButtonText: {
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "600",
  },
  indicator: {
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default SyncStatus;
