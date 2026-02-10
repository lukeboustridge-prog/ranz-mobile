/**
 * SyncErrorSheet Component
 * Bottom sheet showing failed sync items with retry options
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { getAllReports, getPendingUploadPhotos } from "../lib/sqlite";
import type { LocalReport, LocalPhoto } from "../types/database";

interface SyncErrorSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface FailedItem {
  id: string;
  type: "report" | "photo";
  title: string;
  error: string | null;
  updatedAt: string;
}

export function SyncErrorSheet({ visible, onClose }: SyncErrorSheetProps) {
  const { retryFailed, isSyncing, syncState } = useSyncStatus();
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFailedItems();
    }
  }, [visible]);

  const loadFailedItems = async () => {
    setIsLoading(true);
    try {
      const [reports, photos] = await Promise.all([
        getAllReports(),
        getPendingUploadPhotos(),
      ]);

      const items: FailedItem[] = [];

      // Add failed reports
      reports
        .filter((r) => r.syncStatus === "error")
        .forEach((report) => {
          items.push({
            id: report.id,
            type: "report",
            title: report.reportNumber || report.propertyAddress,
            error: report.lastSyncError,
            updatedAt: report.updatedAt,
          });
        });

      // Add failed photos
      photos
        .filter((p) => p.syncStatus === "error")
        .forEach((photo) => {
          items.push({
            id: photo.id,
            type: "photo",
            title: photo.originalFilename || photo.filename,
            error: photo.lastSyncError,
            updatedAt: photo.createdAt,
          });
        });

      // Sort by most recent
      items.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setFailedItems(items);
    } catch (error) {
      console.error("Failed to load failed items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryAll = async () => {
    setIsRetrying(true);
    try {
      await retryFailed();
      await loadFailedItems();
      if (failedItems.length === 0) {
        onClose();
      }
    } catch (error) {
      console.error("Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  const getTypeIcon = (type: "report" | "photo") => {
    return type === "report" ? "📄" : "📷";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>Sync Errors</Text>
            <Text style={styles.subtitle}>
              {failedItems.length} item{failedItems.length !== 1 ? "s" : ""}{" "}
              failed to sync
            </Text>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3c4b5d" />
            </View>
          ) : failedItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>All synced!</Text>
              <Text style={styles.emptySubtitle}>
                No failed items to display
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              {failedItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemIcon}>{getTypeIcon(item.type)}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.type === "report" ? "Report" : "Photo"} •{" "}
                        {formatTime(item.updatedAt)}
                      </Text>
                    </View>
                  </View>
                  {item.error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText} numberOfLines={2}>
                        {item.error}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {!syncState?.isOnline && (
              <View style={styles.offlineWarning}>
                <Text style={styles.offlineText}>
                  You're offline. Connect to retry.
                </Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.closeButton]}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>

              {failedItems.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.retryButton,
                    (!syncState?.isOnline || isRetrying || isSyncing) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleRetryAll}
                  disabled={!syncState?.isOnline || isRetrying || isSyncing}
                >
                  {isRetrying || isSyncing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.retryButtonText}>
                      Retry All ({failedItems.length})
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#22c55e",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  list: {
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemIcon: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  itemMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  errorBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  offlineWarning: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 13,
    color: "#dc2626",
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    backgroundColor: "#f3f4f6",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  retryButton: {
    backgroundColor: "#3c4b5d",
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default SyncErrorSheet;
