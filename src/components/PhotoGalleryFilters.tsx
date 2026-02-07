/**
 * PhotoGalleryFilters Component
 * Bottom sheet filter UI for photo gallery
 *
 * Purpose: Advanced filtering options for inspectors to quickly find
 * specific photos. Supports filtering by photo type, quick tag,
 * annotations, element, and defect.
 */

import React, { memo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Pressable,
} from "react-native";
import type { PhotoFilters, SortOrder } from "../hooks/usePhotoGallery";
import { PhotoType, QuickTag } from "../types/shared";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  TOUCH_TARGET,
} from "../lib/theme";

// ============================================
// TYPES
// ============================================

export interface PhotoGalleryFiltersProps {
  /** Whether the filter sheet is visible */
  visible: boolean;
  /** Callback to close the filter sheet */
  onClose: () => void;
  /** Current active filters */
  filters: PhotoFilters;
  /** Callback when filters are applied */
  onApplyFilters: (filters: PhotoFilters) => void;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Callback when sort order changes */
  onSortOrderChange: (order: SortOrder) => void;
  /** Available defects for filtering */
  availableDefects?: { id: string; title: string }[];
  /** Available roof elements for filtering */
  availableElements?: { id: string; location: string }[];
}

// ============================================
// FILTER CHIP COMPONENT
// ============================================

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

const FilterChip = memo(function FilterChip({
  label,
  isSelected,
  onPress,
}: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ============================================
// RADIO OPTION COMPONENT
// ============================================

interface RadioOptionProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

const RadioOption = memo(function RadioOption({
  label,
  isSelected,
  onPress,
}: RadioOptionProps) {
  return (
    <TouchableOpacity
      style={styles.radioOption}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
    >
      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
        {isSelected && <View style={styles.radioInner} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );
});

// ============================================
// SECTION HEADER COMPONENT
// ============================================

interface SectionHeaderProps {
  title: string;
}

const SectionHeader = memo(function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
});

// ============================================
// PHOTO TYPE OPTIONS
// ============================================

const PHOTO_TYPE_OPTIONS: { label: string; value: PhotoType | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Overview", value: PhotoType.OVERVIEW },
  { label: "Context", value: PhotoType.CONTEXT },
  { label: "Detail", value: PhotoType.DETAIL },
  { label: "Scale", value: PhotoType.SCALE_REFERENCE },
  { label: "General", value: PhotoType.GENERAL },
];

// ============================================
// QUICK TAG OPTIONS
// ============================================

const QUICK_TAG_OPTIONS: { label: string; value: QuickTag | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Defect", value: QuickTag.DEFECT },
  { label: "Good", value: QuickTag.GOOD },
  { label: "Inaccessible", value: QuickTag.INACCESSIBLE },
];

// ============================================
// ANNOTATION OPTIONS
// ============================================

const ANNOTATION_OPTIONS: { label: string; value: boolean | undefined }[] = [
  { label: "Any", value: undefined },
  { label: "Has Annotations", value: true },
  { label: "No Annotations", value: false },
];

// ============================================
// MAIN COMPONENT
// ============================================

export const PhotoGalleryFilters = memo(function PhotoGalleryFilters({
  visible,
  onClose,
  filters,
  onApplyFilters,
  sortOrder,
  onSortOrderChange,
  availableDefects = [],
  availableElements = [],
}: PhotoGalleryFiltersProps) {
  // Local filter state (applied on "Apply" button press)
  const [localFilters, setLocalFilters] = useState<PhotoFilters>(filters);
  const [localSortOrder, setLocalSortOrder] = useState<SortOrder>(sortOrder);

  // Reset local state when modal opens
  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      setLocalSortOrder(sortOrder);
    }
  }, [visible, filters, sortOrder]);

  // Handle apply
  const handleApply = useCallback(() => {
    onApplyFilters(localFilters);
    onSortOrderChange(localSortOrder);
    onClose();
  }, [localFilters, localSortOrder, onApplyFilters, onSortOrderChange, onClose]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setLocalFilters({});
    setLocalSortOrder("desc");
  }, []);

  // Update photo type filter
  const handlePhotoTypeChange = useCallback((value: PhotoType | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      photoType: value,
    }));
  }, []);

  // Update quick tag filter
  const handleQuickTagChange = useCallback((value: QuickTag | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      quickTag: value,
    }));
  }, []);

  // Update annotations filter
  const handleAnnotationsChange = useCallback((value: boolean | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      hasAnnotations: value,
    }));
  }, []);

  // Update element filter
  const handleElementChange = useCallback((value: string | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      roofElementId: value,
    }));
  }, []);

  // Update defect filter
  const handleDefectChange = useCallback((value: string | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      defectId: value,
    }));
  }, []);

  // Check if any filters are active
  const hasFilters =
    localFilters.photoType !== undefined ||
    localFilters.quickTag !== undefined ||
    localFilters.hasAnnotations !== undefined ||
    localFilters.roofElementId !== undefined ||
    localFilters.defectId !== undefined ||
    localSortOrder !== "desc";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Filters</Text>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            disabled={!hasFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text
              style={[
                styles.clearButtonText,
                !hasFilters && styles.clearButtonTextDisabled,
              ]}
            >
              Clear All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Sort Order */}
          <View style={styles.section}>
            <SectionHeader title="Sort Order" />
            <View style={styles.radioGroup}>
              <RadioOption
                label="Newest First"
                isSelected={localSortOrder === "desc"}
                onPress={() => setLocalSortOrder("desc")}
              />
              <RadioOption
                label="Oldest First"
                isSelected={localSortOrder === "asc"}
                onPress={() => setLocalSortOrder("asc")}
              />
            </View>
          </View>

          {/* Photo Type */}
          <View style={styles.section}>
            <SectionHeader title="Photo Type" />
            <View style={styles.chipGroup}>
              {PHOTO_TYPE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.label}
                  label={option.label}
                  isSelected={localFilters.photoType === option.value}
                  onPress={() => handlePhotoTypeChange(option.value)}
                />
              ))}
            </View>
          </View>

          {/* Quick Tag */}
          <View style={styles.section}>
            <SectionHeader title="Quick Tag" />
            <View style={styles.chipGroup}>
              {QUICK_TAG_OPTIONS.map((option) => (
                <FilterChip
                  key={option.label}
                  label={option.label}
                  isSelected={localFilters.quickTag === option.value}
                  onPress={() => handleQuickTagChange(option.value)}
                />
              ))}
            </View>
          </View>

          {/* Annotations */}
          <View style={styles.section}>
            <SectionHeader title="Annotations" />
            <View style={styles.chipGroup}>
              {ANNOTATION_OPTIONS.map((option) => (
                <FilterChip
                  key={option.label}
                  label={option.label}
                  isSelected={localFilters.hasAnnotations === option.value}
                  onPress={() => handleAnnotationsChange(option.value)}
                />
              ))}
            </View>
          </View>

          {/* Roof Element */}
          {availableElements.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Roof Element" />
              <View style={styles.chipGroup}>
                <FilterChip
                  label="Any Element"
                  isSelected={localFilters.roofElementId === undefined}
                  onPress={() => handleElementChange(undefined)}
                />
                {availableElements.map((element) => (
                  <FilterChip
                    key={element.id}
                    label={element.location}
                    isSelected={localFilters.roofElementId === element.id}
                    onPress={() => handleElementChange(element.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Defect */}
          {availableDefects.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Defect" />
              <View style={styles.chipGroup}>
                <FilterChip
                  label="Any Defect"
                  isSelected={localFilters.defectId === undefined}
                  onPress={() => handleDefectChange(undefined)}
                />
                {availableDefects.map((defect) => (
                  <FilterChip
                    key={defect.id}
                    label={defect.title}
                    isSelected={localFilters.defectId === defect.id}
                    onPress={() => handleDefectChange(defect.id)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer with Apply Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.applyButton,
              pressed && styles.applyButtonPressed,
            ]}
            onPress={handleApply}
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.gray[900],
  },
  closeButton: {
    minWidth: 60,
  },
  closeButtonText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.primary[500],
  },
  clearButton: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  clearButtonText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.primary[500],
  },
  clearButtonTextDisabled: {
    color: COLORS.gray[400],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  section: {
    marginBottom: SPACING["2xl"],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    color: COLORS.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
    minHeight: TOUCH_TARGET.minimum,
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: COLORS.primary[500],
  },
  chipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
    color: COLORS.gray[700],
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  radioGroup: {
    gap: SPACING.sm,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TOUCH_TARGET.minimum,
    paddingVertical: SPACING.sm,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray[400],
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  radioCircleSelected: {
    borderColor: COLORS.primary[500],
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary[500],
  },
  radioLabel: {
    fontSize: FONT_SIZES.base,
    color: COLORS.gray[900],
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  applyButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: TOUCH_TARGET.recommended,
  },
  applyButtonPressed: {
    backgroundColor: COLORS.primary[600],
  },
  applyButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: "600",
    color: COLORS.white,
  },
});

export default PhotoGalleryFilters;
