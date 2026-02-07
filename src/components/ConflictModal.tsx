/**
 * ConflictModal
 * Displays when sync detects concurrent edits, allowing user to choose resolution
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from "../lib/theme";

export interface SyncConflict {
  reportId: string;
  reportNumber: string;
  resolution: "client_wins" | "server_wins" | "pending";
  serverUpdatedAt: string;
  clientUpdatedAt: string;
}

export type ConflictResolution = "keep_local" | "keep_server" | "dismiss";

interface ConflictModalProps {
  visible: boolean;
  conflicts: SyncConflict[];
  onResolve: (reportId: string, resolution: ConflictResolution) => void;
  onDismissAll: () => void;
}

export function ConflictModal({
  visible,
  conflicts,
  onResolve,
  onDismissAll,
}: ConflictModalProps) {
  if (conflicts.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismissAll}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sync Conflicts</Text>
          <Text style={styles.subtitle}>
            {conflicts.length} report{conflicts.length !== 1 ? "s" : ""} changed
            on server while you were editing
          </Text>
        </View>

        <ScrollView style={styles.conflictList}>
          {conflicts.map((conflict) => (
            <View key={conflict.reportId} style={styles.conflictItem}>
              <Text style={styles.reportNumber}>
                {conflict.reportNumber || "New Report"}
              </Text>
              <Text style={styles.conflictInfo}>
                Your edit: {formatDate(conflict.clientUpdatedAt)}
              </Text>
              <Text style={styles.conflictInfo}>
                Server edit: {formatDate(conflict.serverUpdatedAt)}
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.keepLocalButton]}
                  onPress={() => onResolve(conflict.reportId, "keep_local")}
                >
                  <Text style={styles.buttonText}>Keep Mine</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.keepServerButton]}
                  onPress={() => onResolve(conflict.reportId, "keep_server")}
                >
                  <Text style={styles.buttonText}>Keep Server</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismissAll}>
            <Text style={styles.dismissButtonText}>
              Dismiss All (Decide Later)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function formatDate(isoString: string): string {
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
    return isoString;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  conflictList: {
    flex: 1,
    padding: SPACING.md,
  },
  conflictItem: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.accent[500],
  },
  reportNumber: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  conflictInfo: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
  },
  keepLocalButton: {
    backgroundColor: COLORS.primary[500],
  },
  keepServerButton: {
    backgroundColor: COLORS.gray[600],
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "500",
    fontSize: FONT_SIZES.sm,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  dismissButton: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  dismissButtonText: {
    color: COLORS.gray[500],
    fontSize: FONT_SIZES.base,
  },
});

export default ConflictModal;
