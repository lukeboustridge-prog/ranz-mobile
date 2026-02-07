/**
 * SyncStatusBar
 * Shows current sync status with pending/failed counts and retry button
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  COLORS,
  SPACING,
  FONT_SIZES,
  BORDER_RADIUS,
  STATUS_COLORS,
  STATUS_BACKGROUNDS,
} from "../lib/theme";

interface SyncStatusBarProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  onRetryFailed: () => void;
  onSync: () => void;
}

export function SyncStatusBar({
  isOnline,
  isSyncing,
  pendingCount,
  failedCount,
  lastSyncAt,
  onRetryFailed,
  onSync,
}: SyncStatusBarProps) {
  const hasIssues = failedCount > 0;
  const hasPending = pendingCount > 0;

  return (
    <View style={[styles.container, !isOnline && styles.offline]}>
      {/* Connection Status */}
      <View style={styles.statusSection}>
        <View
          style={[styles.statusDot, isOnline ? styles.online : styles.offlineDot]}
        />
        <Text style={styles.statusText}>{isOnline ? "Online" : "Offline"}</Text>
      </View>

      {/* Sync State */}
      {isSyncing ? (
        <View style={styles.syncingSection}>
          <ActivityIndicator size="small" color={COLORS.primary[500]} />
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      ) : (
        <View style={styles.countsSection}>
          {hasPending && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pendingCount} pending</Text>
            </View>
          )}
          {hasIssues && (
            <TouchableOpacity
              style={[styles.countBadge, styles.failedBadge]}
              onPress={onRetryFailed}
            >
              <Text style={[styles.countText, styles.failedText]}>
                {failedCount} failed - Tap to retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Sync Button */}
      {isOnline && !isSyncing && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={onSync}
          disabled={!hasPending && !hasIssues}
        >
          <Text
            style={[
              styles.syncButtonText,
              !hasPending && !hasIssues && styles.syncButtonDisabled,
            ]}
          >
            Sync Now
          </Text>
        </TouchableOpacity>
      )}

      {/* Last Sync */}
      {lastSyncAt && !isSyncing && (
        <Text style={styles.lastSyncText}>Last: {formatLastSync(lastSyncAt)}</Text>
      )}
    </View>
  );
}

function formatLastSync(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return "Unknown";
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    gap: SPACING.md,
  },
  offline: {
    backgroundColor: STATUS_BACKGROUNDS.error,
  },
  statusSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS.full,
  },
  online: {
    backgroundColor: STATUS_COLORS.synced,
  },
  offlineDot: {
    backgroundColor: STATUS_COLORS.error,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  syncingSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flex: 1,
  },
  syncingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary[500],
  },
  countsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  countBadge: {
    backgroundColor: COLORS.primary[100],
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  failedBadge: {
    backgroundColor: STATUS_BACKGROUNDS.error,
  },
  countText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary[500],
  },
  failedText: {
    color: STATUS_COLORS.error,
  },
  syncButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  syncButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary[500],
    fontWeight: "500",
  },
  syncButtonDisabled: {
    color: COLORS.gray[400],
  },
  lastSyncText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
  },
});

export default SyncStatusBar;
