/**
 * PhotoEditSheet Component
 * Bottom sheet for editing photo classification and caption
 *
 * Supports the three-level photo documentation method:
 * - Overview: Wide shot showing location
 * - Context: Mid-range showing element in context
 * - Detail: Close-up of specific defect/feature
 *
 * Also supports linking photos to defects and roof elements after capture.
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
  FlatList,
  ActivityIndicator,
} from "react-native";
import type { LocalPhoto, LocalDefect, LocalRoofElement } from "../types/database";
import { PhotoType, QuickTag, ElementType } from "../types/shared";
import { COLORS, BORDER_RADIUS, TOUCH_TARGET, SPACING } from "../lib/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75; // Increased to accommodate new sections
const MAX_CAPTION_LENGTH = 200;

// ============================================
// TYPES
// ============================================

interface PhotoEditSheetProps {
  photo: LocalPhoto | null;
  visible: boolean;
  reportId: string;
  defects?: LocalDefect[];
  elements?: LocalRoofElement[];
  onClose: () => void;
  onSave: (updates: {
    photoType: string;
    quickTag: string | null;
    caption: string | null;
    defectId: string | null;
    roofElementId: string | null;
  }) => Promise<void>;
}

// Element type labels (matching CameraCapture)
const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  [ElementType.ROOF_CLADDING]: "Roof Cladding",
  [ElementType.RIDGE]: "Ridge",
  [ElementType.VALLEY]: "Valley",
  [ElementType.HIP]: "Hip",
  [ElementType.BARGE]: "Barge",
  [ElementType.FASCIA]: "Fascia",
  [ElementType.GUTTER]: "Gutter",
  [ElementType.DOWNPIPE]: "Downpipe",
  [ElementType.FLASHING_WALL]: "Wall Flashing",
  [ElementType.FLASHING_PENETRATION]: "Penetration Flashing",
  [ElementType.SKYLIGHT]: "Skylight",
  [ElementType.VENT]: "Vent",
  [ElementType.OTHER]: "Other",
};

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
  reportId,
  defects: propDefects,
  elements: propElements,
  onClose,
  onSave,
}: PhotoEditSheetProps) {
  const [photoType, setPhotoType] = useState<string>(PhotoType.GENERAL);
  const [quickTag, setQuickTag] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Defect and element association state
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [localDefects, setLocalDefects] = useState<LocalDefect[]>([]);
  const [localElements, setLocalElements] = useState<LocalRoofElement[]>([]);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  const [showDefectPicker, setShowDefectPicker] = useState(false);
  const [showElementPicker, setShowElementPicker] = useState(false);

  // Initialize form with photo values when opened
  useEffect(() => {
    if (photo && visible) {
      setPhotoType(photo.photoType || PhotoType.GENERAL);
      setQuickTag(photo.quickTag || "");
      setCaption(photo.caption || "");
      setSelectedDefectId(photo.defectId || null);
      setSelectedElementId(photo.roofElementId || null);
    }
  }, [photo, visible]);

  // Fetch defects and elements if not provided via props
  useEffect(() => {
    if (!visible || !reportId) return;

    // Use props if provided
    if (propDefects) {
      setLocalDefects(propDefects);
    }
    if (propElements) {
      setLocalElements(propElements);
    }

    // If neither provided, fetch from database (native only)
    if (!propDefects || !propElements) {
      if (Platform.OS === "web") {
        // Web doesn't have SQLite access
        return;
      }

      setIsLoadingRelations(true);
      (async () => {
        try {
          const sqlite = await import("../lib/sqlite");

          if (!propDefects) {
            const defects = await sqlite.getDefectsForReport(reportId);
            setLocalDefects(defects);
          }

          if (!propElements) {
            const elements = await sqlite.getRoofElementsForReport(reportId);
            setLocalElements(elements);
          }
        } catch (err) {
          console.error("[PhotoEditSheet] Failed to fetch relations:", err);
        } finally {
          setIsLoadingRelations(false);
        }
      })();
    }
  }, [visible, reportId, propDefects, propElements]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        photoType,
        quickTag: quickTag || null,
        caption: caption.trim() || null,
        defectId: selectedDefectId,
        roofElementId: selectedElementId,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save photo classification:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get display label for selected defect
  const getSelectedDefectLabel = (): string => {
    if (!selectedDefectId) return "None";
    const defect = localDefects.find((d) => d.id === selectedDefectId);
    if (!defect) return "None";
    return `#${defect.defectNumber}: ${defect.title}`;
  };

  // Get display label for selected element
  const getSelectedElementLabel = (): string => {
    if (!selectedElementId) return "None";
    const element = localElements.find((e) => e.id === selectedElementId);
    if (!element) return "None";
    const typeLabel = ELEMENT_TYPE_LABELS[element.elementType] || element.elementType;
    return `${typeLabel} - ${element.location}`;
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

            {/* Link to Defect Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Link to Defect (Optional)</Text>
              {isLoadingRelations ? (
                <ActivityIndicator size="small" color={COLORS.primary[500]} />
              ) : (
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={() => setShowDefectPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select defect"
                >
                  <Text
                    style={[
                      styles.selectorButtonText,
                      selectedDefectId && styles.selectorButtonTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {getSelectedDefectLabel()}
                  </Text>
                  <Text style={styles.selectorArrow}>▼</Text>
                </TouchableOpacity>
              )}
              {localDefects.length === 0 && !isLoadingRelations && (
                <Text style={styles.noItemsHint}>No defects in this report yet</Text>
              )}
            </View>

            {/* Link to Roof Element Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Link to Roof Element (Optional)</Text>
              {isLoadingRelations ? (
                <ActivityIndicator size="small" color={COLORS.primary[500]} />
              ) : (
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={() => setShowElementPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select roof element"
                >
                  <Text
                    style={[
                      styles.selectorButtonText,
                      selectedElementId && styles.selectorButtonTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {getSelectedElementLabel()}
                  </Text>
                  <Text style={styles.selectorArrow}>▼</Text>
                </TouchableOpacity>
              )}
              {localElements.length === 0 && !isLoadingRelations && (
                <Text style={styles.noItemsHint}>No roof elements in this report yet</Text>
              )}
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

        {/* Defect Picker Modal */}
        <Modal
          visible={showDefectPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDefectPicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Defect</Text>
                <TouchableOpacity onPress={() => setShowDefectPicker(false)}>
                  <Text style={styles.pickerClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={[{ id: null, defectNumber: 0, title: "None" }, ...localDefects]}
                keyExtractor={(item) => item.id || "none"}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      selectedDefectId === item.id && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedDefectId(item.id);
                      setShowDefectPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedDefectId === item.id && styles.pickerOptionTextSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {item.id ? `#${item.defectNumber}: ${item.title}` : "None (No defect link)"}
                    </Text>
                    {selectedDefectId === item.id && (
                      <Text style={styles.pickerCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.pickerList}
              />
            </View>
          </View>
        </Modal>

        {/* Element Picker Modal */}
        <Modal
          visible={showElementPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowElementPicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Roof Element</Text>
                <TouchableOpacity onPress={() => setShowElementPicker(false)}>
                  <Text style={styles.pickerClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={[{ id: null, elementType: null as unknown as ElementType, location: "None" }, ...localElements]}
                keyExtractor={(item) => item.id || "none"}
                renderItem={({ item }) => {
                  const typeLabel = item.elementType
                    ? ELEMENT_TYPE_LABELS[item.elementType] || item.elementType
                    : null;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerOption,
                        selectedElementId === item.id && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedElementId(item.id);
                        setShowElementPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          selectedElementId === item.id && styles.pickerOptionTextSelected,
                        ]}
                        numberOfLines={2}
                      >
                        {typeLabel ? `${typeLabel} - ${item.location}` : "None (No element link)"}
                      </Text>
                      {selectedElementId === item.id && (
                        <Text style={styles.pickerCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.pickerList}
              />
            </View>
          </View>
        </Modal>
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
  // Selector Button Styles
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGET.minimum,
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.gray[500],
  },
  selectorButtonTextSelected: {
    color: COLORS.gray[900],
    fontWeight: "500",
  },
  selectorArrow: {
    color: COLORS.gray[400],
    fontSize: 12,
    marginLeft: SPACING.sm,
  },
  noItemsHint: {
    fontSize: 12,
    color: COLORS.gray[400],
    fontStyle: "italic",
    marginTop: SPACING.xs,
  },
  // Picker Modal Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: "60%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.gray[900],
  },
  pickerClose: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary[600],
  },
  pickerList: {
    paddingBottom: 40,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
    minHeight: TOUCH_TARGET.recommended,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.primary[50],
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.gray[700],
  },
  pickerOptionTextSelected: {
    color: COLORS.primary[700],
    fontWeight: "500",
  },
  pickerCheckmark: {
    fontSize: 18,
    color: COLORS.primary[600],
    fontWeight: "600",
    marginLeft: SPACING.sm,
  },
});

export default PhotoEditSheet;
