/**
 * PhotoEditSheet Component
 * Bottom sheet for editing photo classification and caption
 *
 * Supports the three-level photo documentation method:
 * - Overview: Wide shot showing location
 * - Context: Mid-range showing element in context
 * - Detail: Close-up of specific defect/feature
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import type { LocalPhoto } from "../types/database";
import { PhotoType, QuickTag } from "../types/shared";
import { COLORS, BORDER_RADIUS, TOUCH_TARGET, SPACING } from "../lib/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;
const MAX_CAPTION_LENGTH = 200;

// ============================================
// TYPES
// ============================================

interface PhotoEditSheetProps {
  photo: LocalPhoto | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updates: {
    photoType: string;
    quickTag: string | null;
    caption: string | null;
  }) => Promise<void>;
}

interface ChipOption {
  value: string;
  label: string;
}

// ============================================
// OPTIONS
// ============================================

const PHOTO_TYPE_OPTIONS: ChipOption[] = [
  { value: PhotoType.OVERVIEW, label: "Overview" },
  { value: PhotoType.CONTEXT, label: "Context" },
  { value: PhotoType.DETAIL, label: "Detail" },
  { value: PhotoType.SCALE_REFERENCE, label: "Scale Reference" },
  { value: PhotoType.INACCESSIBLE, label: "Inaccessible" },
  { value: PhotoType.EQUIPMENT, label: "Equipment" },
  { value: PhotoType.GENERAL, label: "General" },
];

const QUICK_TAG_OPTIONS: ChipOption[] = [
  { value: "", label: "No Tag" },
  { value: QuickTag.DEFECT, label: "Defect" },
  { value: QuickTag.GOOD, label: "Good Condition" },
  { value: QuickTag.INACCESSIBLE, label: "Inaccessible Area" },
];

// ============================================
// CHIP BUTTON COMPONENT
// ============================================

interface ChipButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function ChipButton({ label, selected, onPress }: ChipButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.chipSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PhotoEditSheet({
  photo,
  visible,
  onClose,
  onSave,
}: PhotoEditSheetProps) {
  const [photoType, setPhotoType] = useState<string>(PhotoType.GENERAL);
  const [quickTag, setQuickTag] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with photo values when opened
  useEffect(() => {
    if (photo && visible) {
      setPhotoType(photo.photoType || PhotoType.GENERAL);
      setQuickTag(photo.quickTag || "");
      setCaption(photo.caption || "");
    }
  }, [photo, visible]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        photoType,
        quickTag: quickTag || null,
        caption: caption.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save photo classification:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!photo) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityLabel="Close edit sheet"
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
              onPress={handleClose}
              style={styles.cancelButton}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Photo</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              <Text style={[styles.saveButtonText, isSaving && styles.saveButtonTextDisabled]}>
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo Type Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Photo Type</Text>
              <View style={styles.chipGroup}>
                {PHOTO_TYPE_OPTIONS.map((option) => (
                  <ChipButton
                    key={option.value}
                    label={option.label}
                    selected={photoType === option.value}
                    onPress={() => setPhotoType(option.value)}
                  />
                ))}
              </View>
            </View>

            {/* Quick Tag Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Quick Tag (Optional)</Text>
              <View style={styles.chipGroup}>
                {QUICK_TAG_OPTIONS.map((option) => (
                  <ChipButton
                    key={option.value || "none"}
                    label={option.label}
                    selected={quickTag === option.value}
                    onPress={() => setQuickTag(option.value)}
                  />
                ))}
              </View>
            </View>

            {/* Caption Section */}
            <View style={styles.section}>
              <View style={styles.captionLabelRow}>
                <Text style={styles.sectionLabel}>Caption (Optional)</Text>
                <Text style={styles.charCount}>
                  {caption.length}/{MAX_CAPTION_LENGTH}
                </Text>
              </View>
              <TextInput
                style={styles.captionInput}
                value={caption}
                onChangeText={(text) => setCaption(text.slice(0, MAX_CAPTION_LENGTH))}
                placeholder="Add a description for this photo..."
                placeholderTextColor={COLORS.gray[400]}
                multiline
                numberOfLines={3}
                maxLength={MAX_CAPTION_LENGTH}
                textAlignVertical="top"
                accessibilityLabel="Photo caption"
              />
            </View>

            {/* Bottom spacing for keyboard */}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  cancelButton: {
    minWidth: 60,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.gray[600],
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.gray[900],
  },
  saveButton: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary[600],
  },
  saveButtonTextDisabled: {
    color: COLORS.gray[400],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray[700],
    marginBottom: SPACING.sm,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.gray[50],
  },
  chipSelected: {
    backgroundColor: COLORS.primary[500],
    borderColor: COLORS.primary[500],
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.gray[700],
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  captionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.gray[400],
  },
  captionInput: {
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.gray[900],
    minHeight: 80,
  },
  bottomSpacing: {
    height: 40,
  },
});

export default PhotoEditSheet;
