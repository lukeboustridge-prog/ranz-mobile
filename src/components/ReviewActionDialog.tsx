/**
 * ReviewActionDialog Component
 * Modal dialog for reviewer actions (approve, reject, request revision)
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";

// ============================================
// TYPES
// ============================================

export type ReviewActionType = "approve" | "reject" | "revision";

interface ReviewActionDialogProps {
  visible: boolean;
  actionType: ReviewActionType;
  reportNumber: string;
  onConfirm: (note: string, revisionItems?: string[]) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const ACTION_CONFIG: Record<
  ReviewActionType,
  {
    title: string;
    description: string;
    confirmLabel: string;
    confirmColor: string;
    noteRequired: boolean;
    notePlaceholder: string;
    showRevisionItems: boolean;
  }
> = {
  approve: {
    title: "Approve Report",
    description: "Confirm approval of this report. An optional note can be added.",
    confirmLabel: "Approve",
    confirmColor: "#059669",
    noteRequired: false,
    notePlaceholder: "Optional approval note...",
    showRevisionItems: false,
  },
  reject: {
    title: "Reject Report",
    description:
      "Reject this report and return to inspector. A rejection reason is required.",
    confirmLabel: "Reject",
    confirmColor: "#dc2626",
    noteRequired: true,
    notePlaceholder: "Reason for rejection (required)...",
    showRevisionItems: false,
  },
  revision: {
    title: "Request Revision",
    description:
      "Request specific revisions from the inspector. Detail what needs to be changed.",
    confirmLabel: "Request Revision",
    confirmColor: "#d97706",
    noteRequired: true,
    notePlaceholder: "Describe required revisions (required)...",
    showRevisionItems: true,
  },
};

const COMMON_REVISION_ITEMS = [
  "Photo quality needs improvement",
  "Missing defect photos",
  "Incomplete observations",
  "Compliance checklist incomplete",
  "Missing measurements",
  "Description lacks detail",
  "Code references missing",
  "Recommendations unclear",
];

// ============================================
// COMPONENT
// ============================================

export function ReviewActionDialog({
  visible,
  actionType,
  reportNumber,
  onConfirm,
  onCancel,
}: ReviewActionDialogProps) {
  const [note, setNote] = useState("");
  const [selectedRevisionItems, setSelectedRevisionItems] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = ACTION_CONFIG[actionType];

  const handleConfirm = async () => {
    setError(null);

    // Validate required note
    if (config.noteRequired && !note.trim()) {
      setError("Please provide a reason/description");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(
        note.trim(),
        config.showRevisionItems ? selectedRevisionItems : undefined
      );
      // Reset state on success
      setNote("");
      setSelectedRevisionItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNote("");
    setSelectedRevisionItems([]);
    setError(null);
    onCancel();
  };

  const toggleRevisionItem = (item: string) => {
    setSelectedRevisionItems((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.reportNumber}>{reportNumber}</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Description */}
              <Text style={styles.description}>{config.description}</Text>

              {/* Quick Select Revision Items */}
              {config.showRevisionItems && (
                <View style={styles.revisionSection}>
                  <Text style={styles.sectionLabel}>Common Issues (tap to select)</Text>
                  <View style={styles.revisionItems}>
                    {COMMON_REVISION_ITEMS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.revisionItem,
                          selectedRevisionItems.includes(item) &&
                            styles.revisionItemSelected,
                        ]}
                        onPress={() => toggleRevisionItem(item)}
                      >
                        <Text
                          style={[
                            styles.revisionItemText,
                            selectedRevisionItems.includes(item) &&
                              styles.revisionItemTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Note Input */}
              <View style={styles.noteSection}>
                <Text style={styles.sectionLabel}>
                  {config.noteRequired ? "Details (required)" : "Note (optional)"}
                </Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder={config.notePlaceholder}
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: config.confirmColor },
                  isSubmitting && styles.buttonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>{config.confirmLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  reportNumber: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  description: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 20,
  },
  revisionSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  revisionItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  revisionItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  revisionItemSelected: {
    backgroundColor: "#fef3c7",
    borderColor: "#d97706",
  },
  revisionItemText: {
    fontSize: 13,
    color: "#4b5563",
  },
  revisionItemTextSelected: {
    color: "#92400e",
    fontWeight: "500",
  },
  noteSection: {
    marginBottom: 20,
  },
  noteInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 100,
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4b5563",
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ReviewActionDialog;
