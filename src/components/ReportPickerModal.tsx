/**
 * ReportPickerModal Component
 * Quick-select modal for choosing which report to associate captures with
 *
 * Provides a streamlined workflow for inspectors to select a report
 * before starting photo capture, reducing navigation friction.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import type { LocalReport } from "../types/database";
import { COLORS, BORDER_RADIUS, TOUCH_TARGET, SPACING } from "../lib/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;
const MAX_REPORTS = 10;

// SQLite is not supported on web - only import on native
const isNative = Platform.OS !== "web";

// ============================================
// TYPES
// ============================================

interface ReportPickerModalProps {
  visible: boolean;
  onSelect: (reportId: string) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSyncStatusColor(status: string): string {
  switch (status) {
    case "synced":
      return "#16a34a";
    case "pending":
      return "#d97706";
    case "error":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function getSyncStatusBgColor(status: string): string {
  switch (status) {
    case "synced":
      return "#dcfce7";
    case "pending":
      return "#fef3c7";
    case "error":
      return "#fee2e2";
    default:
      return "#f3f4f6";
  }
}

// ============================================
// REPORT ITEM COMPONENT
// ============================================

interface ReportItemProps {
  report: LocalReport;
  onSelect: (reportId: string) => void;
}

function ReportItem({ report, onSelect }: ReportItemProps) {
  return (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => onSelect(report.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Select report ${report.reportNumber || "Draft"} at ${report.propertyAddress}`}
    >
      <View style={styles.reportHeader}>
        <Text style={styles.reportNumber}>
          {report.reportNumber || "Draft"}
        </Text>
        <View
          style={[
            styles.syncBadge,
            { backgroundColor: getSyncStatusBgColor(report.syncStatus) },
          ]}
        >
          <Text
            style={[
              styles.syncText,
              { color: getSyncStatusColor(report.syncStatus) },
            ]}
          >
            {report.syncStatus}
          </Text>
        </View>
      </View>
      <Text style={styles.reportAddress} numberOfLines={1}>
        {report.propertyAddress}, {report.propertyCity}
      </Text>
      <Text style={styles.reportDate}>{formatDate(report.inspectionDate)}</Text>
    </TouchableOpacity>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReportPickerModal({
  visible,
  onSelect,
  onClose,
  onCreateNew,
}: ReportPickerModalProps) {
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load reports when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadReports();
    }
  }, [visible]);

  const loadReports = async () => {
    if (!isNative) {
      // Web mode - no SQLite available
      console.log("[ReportPickerModal] Running in web mode - SQLite not available");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const sqlite = await import("../lib/sqlite");
      const allReports = await sqlite.getAllReports();
      // getAllReports already sorts by updated_at DESC, just slice to max
      setReports(allReports.slice(0, MAX_REPORTS));
    } catch (error) {
      console.error("[ReportPickerModal] Failed to load reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (reportId: string) => {
    onSelect(reportId);
  };

  const renderReportItem = ({ item }: { item: LocalReport }) => (
    <ReportItem report={item} onSelect={handleSelect} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No reports yet</Text>
      <Text style={styles.emptySubtitle}>
        Create a report to start capturing photos
      </Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={COLORS.primary[500]} />
      <Text style={styles.loadingText}>Loading reports...</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close report picker"
        />

        {/* Sheet */}
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Report</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isLoading ? (
              renderLoadingState()
            ) : (
              <FlatList
                data={reports}
                renderItem={renderReportItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={
                  reports.length === 0 ? styles.emptyContainer : styles.listContainer
                }
                ListEmptyComponent={renderEmptyState}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          {/* Bottom Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.newReportButton}
              onPress={onCreateNew}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Create new report"
            >
              <Text style={styles.newReportButtonText}>+ New Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

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
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.gray[300],
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  closeButton: {
    minWidth: 60,
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.gray[600],
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.gray[900],
  },
  headerSpacer: {
    minWidth: 60,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.gray[500],
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: "center",
  },
  reportCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    minHeight: TOUCH_TARGET.minimum,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  reportNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray[900],
  },
  syncBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  syncText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  reportAddress: {
    fontSize: 14,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  reportDate: {
    fontSize: 12,
    color: COLORS.gray[400],
  },
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING["2xl"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  newReportButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: "center",
    minHeight: TOUCH_TARGET.minimum,
    justifyContent: "center",
  },
  newReportButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ReportPickerModal;
