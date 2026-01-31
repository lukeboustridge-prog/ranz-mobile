/**
 * ConflictResolutionModal
 * Presents sync conflicts to inspector for manual resolution
 *
 * When a report is modified both locally and on the server, this modal
 * displays the conflicts and allows the inspector to choose which version
 * to keep for each conflicting item.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import type { SyncConflict, ConflictResolution } from "../types/sync";
import { COLORS, SPACING, BORDER_RADIUS, TOUCH_TARGET, FONT_SIZES } from "../lib/theme";

// ============================================
// TYPES
// ============================================

interface ConflictResolutionModalProps {
  visible: boolean;
  conflicts: SyncConflict[];
  onResolve: (resolutions: Array<{ entityId: string; resolution: ConflictResolution }>) => void;
  onDismiss: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-NZ", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Unknown";
  }
}

function formatEntityType(type: string): string {
  const labels: Record<string, string> = {
    report: "Report",
    photo: "Photo",
    defect: "Defect",
    element: "Roof Element",
    compliance: "Compliance",
  };
  return labels[type] || type;
}

// ============================================
// CONFLICT CARD COMPONENT
// ============================================

interface ConflictCardProps {
  conflict: SyncConflict;
  index: number;
  selected: ConflictResolution | undefined;
  onSelect: (resolution: ConflictResolution) => void;
}

function ConflictCard({ conflict, index, selected, onSelect }: ConflictCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={styles.conflictBadge}>
            <Text style={styles.conflictBadgeText}>#{index}</Text>
          </View>
          <Text style={styles.cardTitle}>{formatEntityType(conflict.entityType)}</Text>
        </View>
        <Text style={styles.cardId}>{conflict.entityId.slice(0, 8)}...</Text>
      </View>

      <View style={styles.versionsContainer}>
        <View style={styles.versionColumn}>
          <View style={styles.versionIconContainer}>
            <Text style={styles.versionIcon}>&#128241;</Text>
          </View>
          <Text style={styles.versionLabel}>Your Device</Text>
          <Text style={styles.versionTime}>{formatDateTime(conflict.localUpdatedAt)}</Text>
        </View>

        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.versionSeparator}>vs</Text>
          <View style={styles.separatorLine} />
        </View>

        <View style={styles.versionColumn}>
          <View style={styles.versionIconContainer}>
            <Text style={styles.versionIcon}>&#9729;</Text>
          </View>
          <Text style={styles.versionLabel}>Server</Text>
          <Text style={styles.versionTime}>{formatDateTime(conflict.serverUpdatedAt)}</Text>
        </View>
      </View>

      <View style={styles.resolutionButtons}>
        <TouchableOpacity
          style={[
            styles.resolutionButton,
            selected === "keep_local" && styles.resolutionButtonSelected,
          ]}
          onPress={() => onSelect("keep_local")}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === "keep_local" }}
          accessibilityLabel="Keep my changes"
        >
          <Text
            style={[
              styles.resolutionButtonText,
              selected === "keep_local" && styles.resolutionButtonTextSelected,
            ]}
          >
            Keep My Changes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.resolutionButton,
            selected === "keep_server" && styles.resolutionButtonSelected,
          ]}
          onPress={() => onSelect("keep_server")}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === "keep_server" }}
          accessibilityLabel="Use server version"
        >
          <Text
            style={[
              styles.resolutionButtonText,
              selected === "keep_server" && styles.resolutionButtonTextSelected,
            ]}
          >
            Use Server Version
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ConflictResolutionModal({
  visible,
  conflicts,
  onResolve,
  onDismiss,
}: ConflictResolutionModalProps) {
  // Track selected resolution for each conflict
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});

  // Reset resolutions when modal opens with new conflicts
  useEffect(() => {
    if (visible) {
      setResolutions({});
    }
  }, [visible, conflicts]);

  const handleSelect = useCallback((entityId: string, resolution: ConflictResolution) => {
    setResolutions((prev) => ({ ...prev, [entityId]: resolution }));
  }, []);

  const handleResolveAll = useCallback(() => {
    const resolved = conflicts.map((c) => ({
      entityId: c.entityId,
      resolution: resolutions[c.entityId] || "keep_server", // Default to server if not selected
    }));
    onResolve(resolved);
  }, [conflicts, resolutions, onResolve]);

  const allResolved = conflicts.every((c) => resolutions[c.entityId]);
  const resolvedCount = Object.keys(resolutions).length;

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>&#9888;</Text>
          </View>
          <Text style={styles.title}>Sync Conflicts Detected</Text>
          <Text style={styles.subtitle}>
            {conflicts.length} item{conflicts.length !== 1 ? "s" : ""} modified on both this device
            and the server
          </Text>
        </View>

        {/* Conflict List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          {conflicts.map((conflict, index) => (
            <ConflictCard
              key={conflict.entityId}
              conflict={conflict}
              index={index + 1}
              selected={resolutions[conflict.entityId]}
              onSelect={(resolution) => handleSelect(conflict.entityId, resolution)}
            />
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Decide later"
          >
            <Text style={styles.dismissButtonText}>Decide Later</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resolveButton, !allResolved && styles.resolveButtonDisabled]}
            onPress={handleResolveAll}
            disabled={!allResolved}
            accessibilityRole="button"
            accessibilityLabel={`Resolve ${allResolved ? "all" : `${resolvedCount} of ${conflicts.length}`} conflicts`}
            accessibilityState={{ disabled: !allResolved }}
          >
            <Text style={styles.resolveButtonText}>
              Resolve {allResolved ? "All" : `(${resolvedCount}/${conflicts.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: SPACING.xl,
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight ?? 44) + SPACING.lg,
    backgroundColor: "#fef3c715", // Subtle amber background
    borderBottomWidth: 1,
    borderBottomColor: "#f59e0b30",
    alignItems: "center",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  headerIconText: {
    fontSize: 24,
    color: "#d97706",
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  conflictBadge: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  conflictBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    color: COLORS.white,
  },
  cardTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: "600",
    color: COLORS.gray[900],
  },
  cardId: {
    fontSize: 11,
    color: COLORS.gray[400],
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  versionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  versionColumn: {
    alignItems: "center",
    flex: 1,
  },
  versionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  versionIcon: {
    fontSize: 18,
  },
  versionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
    color: COLORS.gray[600],
    marginBottom: 2,
  },
  versionTime: {
    fontSize: 11,
    color: COLORS.gray[500],
    textAlign: "center",
  },
  separatorContainer: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  separatorLine: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.gray[200],
  },
  versionSeparator: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    fontWeight: "500",
    paddingVertical: 4,
  },
  resolutionButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  resolutionButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.white,
    alignItems: "center",
    minHeight: TOUCH_TARGET.minimum,
    justifyContent: "center",
  },
  resolutionButtonSelected: {
    borderColor: COLORS.primary[500],
    backgroundColor: `${COLORS.primary[500]}15`,
  },
  resolutionButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
    color: COLORS.gray[600],
    textAlign: "center",
  },
  resolutionButtonTextSelected: {
    color: COLORS.primary[500],
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    padding: SPACING.lg,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
    paddingBottom: Platform.OS === "ios" ? 34 : SPACING.lg, // Safe area
  },
  dismissButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    alignItems: "center",
    minHeight: TOUCH_TARGET.recommended,
    justifyContent: "center",
  },
  dismissButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: "500",
    color: COLORS.gray[600],
  },
  resolveButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary[500],
    alignItems: "center",
    minHeight: TOUCH_TARGET.recommended,
    justifyContent: "center",
  },
  resolveButtonDisabled: {
    backgroundColor: COLORS.gray[400],
  },
  resolveButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: "600",
    color: COLORS.white,
  },
});

export default ConflictResolutionModal;
