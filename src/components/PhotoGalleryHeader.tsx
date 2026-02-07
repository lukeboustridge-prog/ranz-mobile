/**
 * PhotoGalleryHeader Component
 * Header for photo gallery with group mode tabs, filter button, and view toggle
 *
 * Purpose: Provides navigation and organization controls for the photo gallery.
 * Inspectors can quickly switch between grouping modes (date, element, tag, defect)
 * and toggle between grid and list views.
 */

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import type { GroupBy } from "../hooks/usePhotoGallery";
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

export interface PhotoGalleryHeaderProps {
  /** Current grouping mode */
  groupBy: GroupBy;
  /** Callback when group mode changes */
  onGroupByChange: (groupBy: GroupBy) => void;
  /** Current view mode */
  viewMode: "grid" | "list";
  /** Callback when view mode changes */
  onViewModeChange: (mode: "grid" | "list") => void;
  /** Total number of photos (before filtering) */
  photoCount: number;
  /** Number of photos after filtering */
  filteredCount: number;
  /** Callback when filter button pressed */
  onFilterPress: () => void;
  /** Whether any filters are active */
  hasActiveFilters: boolean;
}

// ============================================
// GROUP MODE TAB COMPONENT
// ============================================

interface GroupTabProps {
  label: string;
  value: GroupBy;
  isSelected: boolean;
  onPress: (value: GroupBy) => void;
}

const GroupTab = memo(function GroupTab({
  label,
  value,
  isSelected,
  onPress,
}: GroupTabProps) {
  const handlePress = useCallback(() => {
    onPress(value);
  }, [onPress, value]);

  return (
    <TouchableOpacity
      style={[styles.groupTab, isSelected && styles.groupTabSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Group by ${label}`}
    >
      <Text
        style={[styles.groupTabText, isSelected && styles.groupTabTextSelected]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ============================================
// GROUP MODE TABS DATA
// ============================================

const GROUP_TABS: { label: string; value: GroupBy }[] = [
  { label: "All", value: "none" },
  { label: "By Date", value: "date" },
  { label: "By Element", value: "element" },
  { label: "By Tag", value: "tag" },
  { label: "By Defect", value: "defect" },
];

// ============================================
// MAIN COMPONENT
// ============================================

export const PhotoGalleryHeader = memo(function PhotoGalleryHeader({
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
  photoCount,
  filteredCount,
  onFilterPress,
  hasActiveFilters,
}: PhotoGalleryHeaderProps) {
  // Toggle view mode
  const handleViewModeToggle = useCallback(() => {
    onViewModeChange(viewMode === "grid" ? "list" : "grid");
  }, [viewMode, onViewModeChange]);

  // Format photo count display
  const photoCountText =
    filteredCount < photoCount
      ? `${filteredCount} of ${photoCount} photos`
      : `${photoCount} photo${photoCount !== 1 ? "s" : ""}`;

  return (
    <View style={styles.container}>
      {/* Top Row: Title, Filter, View Toggle */}
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Photos</Text>
          <Text style={styles.photoCount}>{photoCountText}</Text>
        </View>

        <View style={styles.actions}>
          {/* Filter Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onFilterPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              hasActiveFilters ? "Filters active, open filters" : "Open filters"
            }
          >
            <Text style={styles.actionIcon}>
              {/* Filter icon using text */}
              {"\u2630"}
            </Text>
            {hasActiveFilters && (
              <View style={styles.filterBadge}>
                <View style={styles.filterBadgeDot} />
              </View>
            )}
          </TouchableOpacity>

          {/* View Mode Toggle */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleViewModeToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
          >
            <Text style={styles.actionIcon}>
              {/* Grid or list icon using text symbols */}
              {viewMode === "grid" ? "\u2261" : "\u2637"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Row: Group Mode Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        accessibilityRole="tablist"
        accessibilityLabel="Photo grouping options"
      >
        {GROUP_TABS.map((tab) => (
          <GroupTab
            key={tab.value}
            label={tab.label}
            value={tab.value}
            isSelected={groupBy === tab.value}
            onPress={onGroupByChange}
          />
        ))}
      </ScrollView>
    </View>
  );
});

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES["2xl"],
    fontWeight: "700",
    color: COLORS.gray[900],
  },
  photoCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  actionButton: {
    width: TOUCH_TARGET.minimum,
    height: TOUCH_TARGET.minimum,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.gray[700],
  },
  filterBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary[500],
  },
  tabsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  groupTab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
    minHeight: TOUCH_TARGET.minimum,
    justifyContent: "center",
  },
  groupTabSelected: {
    backgroundColor: COLORS.primary[500],
  },
  groupTabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
    color: COLORS.gray[700],
  },
  groupTabTextSelected: {
    color: COLORS.white,
  },
});

export default PhotoGalleryHeader;
