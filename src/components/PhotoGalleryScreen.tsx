/**
 * PhotoGalleryScreen Component
 * Main gallery screen with filtering, grouping, and navigation
 *
 * Purpose: Central photo management interface for inspectors. Combines the
 * usePhotoGallery hook with UI components for browsing, organizing, and
 * finding photos captured during an inspection.
 *
 * Features:
 * - Grid and list view modes
 * - Grouping by date, element, tag, or defect
 * - Filtering by photo type, tag, annotations, element, defect
 * - Empty states with contextual messages
 * - Floating action button for adding new photos
 */

import React, { memo, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  SectionList,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from "react-native";
import type { LocalPhoto } from "../types/database";
import {
  usePhotoGallery,
  type PhotoFilters,
  type GroupBy,
} from "../hooks";
import { PhotoGalleryHeader } from "./PhotoGalleryHeader";
import { PhotoGalleryFilters } from "./PhotoGalleryFilters";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  TOUCH_TARGET,
} from "../lib/theme";

// ============================================
// CONSTANTS
// ============================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 4;
const GRID_PADDING = SPACING.sm;
const NUM_COLUMNS = 3;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// ============================================
// TYPES
// ============================================

export interface PhotoGalleryScreenProps {
  /** Array of photos to display */
  photos: LocalPhoto[];
  /** Callback when a photo is pressed */
  onPhotoPress: (photo: LocalPhoto, index: number) => void;
  /** Callback when add photo button pressed */
  onAddPhoto?: () => void;
  /** Whether to show the add photo FAB */
  showAddButton?: boolean;
  /** Available defects for filtering */
  defects?: { id: string; title: string }[];
  /** Available roof elements for filtering */
  roofElements?: { id: string; location: string }[];
}

// ============================================
// GRID PHOTO ITEM
// ============================================

interface GridPhotoItemProps {
  photo: LocalPhoto;
  onPress: () => void;
}

const GridPhotoItem = memo(function GridPhotoItem({
  photo,
  onPress,
}: GridPhotoItemProps) {
  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={photo.caption || `Photo ${photo.id.substring(0, 8)}`}
    >
      <Image
        source={{ uri: photo.thumbnailUri || photo.localUri }}
        style={styles.gridImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {photo.quickTag && (
        <View style={styles.tagBadge}>
          <Text style={styles.tagBadgeText}>
            {photo.quickTag === "DEFECT" ? "D" : photo.quickTag === "GOOD" ? "G" : "I"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ============================================
// LIST PHOTO ITEM
// ============================================

interface ListPhotoItemProps {
  photo: LocalPhoto;
  onPress: () => void;
}

const ListPhotoItem = memo(function ListPhotoItem({
  photo,
  onPress,
}: ListPhotoItemProps) {
  // Format date for display
  const dateDisplay = useMemo(() => {
    const dateStr = photo.capturedAt || photo.createdAt;
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString("en-NZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [photo.capturedAt, photo.createdAt]);

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={photo.caption || `Photo ${photo.id.substring(0, 8)}`}
    >
      <Image
        source={{ uri: photo.thumbnailUri || photo.localUri }}
        style={styles.listImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <View style={styles.listContent}>
        <Text style={styles.listCaption} numberOfLines={2}>
          {photo.caption || photo.photoType || "Photo"}
        </Text>
        <Text style={styles.listMeta}>
          {dateDisplay}
          {photo.quickTag && ` \u2022 ${photo.quickTag}`}
        </Text>
      </View>
      <View style={styles.listChevron}>
        <Text style={styles.chevronText}>{"\u203A"}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ============================================
// SECTION HEADER
// ============================================

interface SectionHeaderProps {
  title: string;
  count: number;
}

const SectionHeader = memo(function SectionHeader({
  title,
  count,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
});

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  hasFilters: boolean;
}

const EmptyState = memo(function EmptyState({ hasFilters }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{hasFilters ? "\uD83D\uDD0D" : "\uD83D\uDCF7"}</Text>
      <Text style={styles.emptyTitle}>
        {hasFilters ? "No photos match filters" : "No photos"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasFilters
          ? "Try adjusting your filters to see more photos"
          : "Capture photos to add them to your inspection"}
      </Text>
    </View>
  );
});

// ============================================
// FLOATING ACTION BUTTON
// ============================================

interface FABProps {
  onPress: () => void;
}

const FAB = memo(function FAB({ onPress }: FABProps) {
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Add new photo"
    >
      <Text style={styles.fabIcon}>+</Text>
    </TouchableOpacity>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

export const PhotoGalleryScreen = memo(function PhotoGalleryScreen({
  photos,
  onPhotoPress,
  onAddPhoto,
  showAddButton = true,
  defects = [],
  roofElements = [],
}: PhotoGalleryScreenProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  // Use photo gallery hook for filtering, sorting, and grouping
  const {
    photos: filteredPhotos,
    groupedPhotos,
    filters,
    setFilters,
    groupBy,
    setGroupBy,
    sortOrder,
    setSortOrder,
    totalCount,
    filteredCount,
    clearFilters,
  } = usePhotoGallery(photos);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.photoType !== undefined ||
      filters.quickTag !== undefined ||
      filters.hasAnnotations !== undefined ||
      filters.roofElementId !== undefined ||
      filters.defectId !== undefined
    );
  }, [filters]);

  // Open/close filter modal
  const handleOpenFilters = useCallback(() => {
    setShowFilters(true);
  }, []);

  const handleCloseFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  // Handle filter application
  const handleApplyFilters = useCallback(
    (newFilters: PhotoFilters) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Render grid item
  const renderGridItem = useCallback(
    ({ item, index }: { item: LocalPhoto; index: number }) => (
      <GridPhotoItem
        photo={item}
        onPress={() => onPhotoPress(item, index)}
      />
    ),
    [onPhotoPress]
  );

  // Render list item
  const renderListItem = useCallback(
    ({ item, index }: { item: LocalPhoto; index: number }) => (
      <ListPhotoItem
        photo={item}
        onPress={() => onPhotoPress(item, index)}
      />
    ),
    [onPhotoPress]
  );

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; data: LocalPhoto[] } }) => (
      <SectionHeader title={section.title} count={section.data.length} />
    ),
    []
  );

  // Key extractors
  const keyExtractor = useCallback((item: LocalPhoto) => item.id, []);

  // Get item layout for grid (performance optimization)
  const getItemLayout = useCallback(
    (_: ArrayLike<LocalPhoto> | null | undefined, index: number) => ({
      length: GRID_ITEM_SIZE + GRID_GAP,
      offset: (GRID_ITEM_SIZE + GRID_GAP) * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    []
  );

  // Render content based on view mode and grouping
  const renderContent = () => {
    // Empty state
    if (filteredPhotos.length === 0) {
      return <EmptyState hasFilters={hasActiveFilters} />;
    }

    // Grid view (ungrouped or grouped with inline headers)
    if (viewMode === "grid") {
      if (groupBy === "none") {
        return (
          <FlatList
            data={filteredPhotos}
            renderItem={renderGridItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            getItemLayout={getItemLayout}
            removeClippedSubviews
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        );
      }

      // Grouped grid - use SectionList with grid rendering
      return (
        <SectionList
          sections={groupedPhotos}
          renderItem={({ item, index }) => {
            // For grid layout in section list, render every 3rd item as a row
            const sectionIndex = groupedPhotos.findIndex((s) =>
              s.data.includes(item)
            );
            const itemIndex = groupedPhotos[sectionIndex]?.data.indexOf(item) ?? 0;

            // Only render if it's the first item in a potential row of 3
            if (itemIndex % NUM_COLUMNS !== 0) {
              return null;
            }

            // Get up to 3 items for this row
            const rowItems = groupedPhotos[sectionIndex]?.data.slice(
              itemIndex,
              itemIndex + NUM_COLUMNS
            ) ?? [];

            return (
              <View style={styles.gridRow}>
                {rowItems.map((photo, i) => (
                  <GridPhotoItem
                    key={photo.id}
                    photo={photo}
                    onPress={() => onPhotoPress(photo, itemIndex + i)}
                  />
                ))}
                {/* Fill empty slots to maintain grid alignment */}
                {Array.from({ length: NUM_COLUMNS - rowItems.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.gridItemEmpty} />
                ))}
              </View>
            );
          }}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.gridContainer}
        />
      );
    }

    // List view - always use SectionList
    return (
      <SectionList
        sections={groupedPhotos}
        renderItem={renderListItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with group tabs and filter button */}
      <PhotoGalleryHeader
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        photoCount={totalCount}
        filteredCount={filteredCount}
        onFilterPress={handleOpenFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Photo content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Add Photo FAB */}
      {showAddButton && onAddPhoto && <FAB onPress={onAddPhoto} />}

      {/* Filter Modal */}
      <PhotoGalleryFilters
        visible={showFilters}
        onClose={handleCloseFilters}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        availableDefects={defects}
        availableElements={roofElements}
      />
    </SafeAreaView>
  );
});

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  content: {
    flex: 1,
  },
  // Grid styles
  gridContainer: {
    padding: GRID_PADDING,
  },
  gridRow: {
    flexDirection: "row",
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: BORDER_RADIUS.sm,
    overflow: "hidden",
    backgroundColor: COLORS.gray[200],
  },
  gridItemEmpty: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  tagBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  tagBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700",
  },
  // List styles
  listContainer: {
    paddingVertical: SPACING.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    minHeight: TOUCH_TARGET.recommended,
  },
  listImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray[200],
  },
  listContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  listCaption: {
    fontSize: FONT_SIZES.base,
    fontWeight: "500",
    color: COLORS.gray[900],
  },
  listMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  listChevron: {
    paddingLeft: SPACING.sm,
  },
  chevronText: {
    fontSize: FONT_SIZES["2xl"],
    color: COLORS.gray[400],
  },
  listSeparator: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginLeft: SPACING.lg + 56 + SPACING.md, // Align with text, not image
  },
  // Section header styles
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[100],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    color: COLORS.gray[700],
  },
  sectionCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING["3xl"],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.gray[700],
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.base,
    color: COLORS.gray[500],
    textAlign: "center",
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: SPACING["2xl"],
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary[500],
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: "400",
    lineHeight: 28,
  },
});

export default PhotoGalleryScreen;
