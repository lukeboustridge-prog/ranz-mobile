/**
 * PhotoGrid Component
 * Virtualized 2-column grid display of photos with add button
 * Optimized for performance with large photo collections
 */

import React, { useCallback, memo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  type ListRenderItemInfo,
} from "react-native";
import type { LocalPhoto } from "../types/database";
import { TOUCH_TARGET, BORDER_RADIUS, COLORS } from "../lib/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 8;
const GRID_PADDING = 16;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1) - 32) / NUM_COLUMNS;

// ============================================
// TYPES
// ============================================

interface PhotoGridProps {
  photos: LocalPhoto[];
  onAddPhoto: () => void;
  onRemovePhoto?: (id: string) => void;
  onViewPhoto?: (photo: LocalPhoto) => void;
  showAddButton?: boolean;
  maxPhotos?: number;
}

interface AddButtonItem {
  id: "add-button";
  type: "add";
}

type GridItem = LocalPhoto | AddButtonItem;

// ============================================
// PHOTO ITEM COMPONENT (memoized)
// ============================================

interface PhotoItemProps {
  photo: LocalPhoto;
  onView?: (photo: LocalPhoto) => void;
  onRemove?: (id: string) => void;
}

const PhotoItem = memo(function PhotoItem({ photo, onView, onRemove }: PhotoItemProps) {
  const handlePress = useCallback(() => {
    onView?.(photo);
  }, [onView, photo]);

  const handleRemove = useCallback(() => {
    onRemove?.(photo.id);
  }, [onRemove, photo.id]);

  return (
    <TouchableOpacity
      style={styles.photoContainer}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={photo.caption || `Photo ${photo.id.substring(0, 8)}`}
      accessibilityHint="Double tap to view full size"
    >
      <Image
        source={{ uri: photo.thumbnailUri || photo.localUri }}
        style={styles.photo}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      )}
      {photo.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption} numberOfLines={1}>
            {photo.caption}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ============================================
// ADD BUTTON COMPONENT (memoized)
// ============================================

interface AddButtonProps {
  onPress: () => void;
}

const AddButton = memo(function AddButton({ onPress }: AddButtonProps) {
  return (
    <TouchableOpacity
      style={styles.addButton}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Add new photo"
      accessibilityHint="Opens camera to capture a new photo"
    >
      <Text style={styles.addIcon}>+</Text>
      <Text style={styles.addText}>Add Photo</Text>
    </TouchableOpacity>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

export function PhotoGrid({
  photos,
  onAddPhoto,
  onRemovePhoto,
  onViewPhoto,
  showAddButton = true,
  maxPhotos,
}: PhotoGridProps) {
  // Build data array with optional add button
  const addButtonItem: AddButtonItem = { id: "add-button", type: "add" };
  const data: GridItem[] = [
    ...photos,
    ...(showAddButton && (!maxPhotos || photos.length < maxPhotos)
      ? [addButtonItem]
      : []),
  ];

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GridItem>) => {
      if ("type" in item && item.type === "add") {
        return <AddButton onPress={onAddPhoto} />;
      }

      return (
        <PhotoItem
          photo={item as LocalPhoto}
          onView={onViewPhoto}
          onRemove={onRemovePhoto}
        />
      );
    },
    [onAddPhoto, onViewPhoto, onRemovePhoto]
  );

  const keyExtractor = useCallback((item: GridItem) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<GridItem> | null | undefined, index: number) => ({
      length: ITEM_WIDTH + GRID_GAP,
      offset: (ITEM_WIDTH + GRID_GAP) * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    []
  );

  if (photos.length === 0 && !showAddButton) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📷</Text>
        <Text style={styles.emptyText}>No photos</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      getItemLayout={getItemLayout}
      removeClippedSubviews={true}
      initialNumToRender={6}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      scrollEnabled={false} // Usually inside ScrollView
      accessibilityRole="list"
      accessibilityLabel={`Photo gallery with ${photos.length} photos`}
    />
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  photoContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderRadius: BORDER_RADIUS.md,
    overflow: "hidden",
    backgroundColor: COLORS.gray[100],
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: TOUCH_TARGET.minimum / 2, // Small but with hitSlop
    height: TOUCH_TARGET.minimum / 2,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  captionContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  caption: {
    color: COLORS.white,
    fontSize: 10,
  },
  addButton: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.gray[50],
    minHeight: TOUCH_TARGET.recommended,
  },
  addIcon: {
    fontSize: 28,
    color: COLORS.gray[400],
    marginBottom: 4,
  },
  addText: {
    fontSize: 12,
    color: COLORS.gray[500],
    fontWeight: "500",
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray[400],
  },
});

export default PhotoGrid;
