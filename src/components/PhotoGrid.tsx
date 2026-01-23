/**
 * PhotoGrid Component
 * 2-column grid display of photos with add button
 */

import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import type { LocalPhoto } from "../types/database";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 8;
const GRID_PADDING = 16;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1) - 32) / NUM_COLUMNS;

interface PhotoGridProps {
  photos: LocalPhoto[];
  onAddPhoto: () => void;
  onRemovePhoto?: (id: string) => void;
  onViewPhoto?: (photo: LocalPhoto) => void;
  showAddButton?: boolean;
}

export function PhotoGrid({
  photos,
  onAddPhoto,
  onRemovePhoto,
  onViewPhoto,
  showAddButton = true,
}: PhotoGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            style={styles.photoContainer}
            onPress={() => onViewPhoto?.(photo)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: photo.thumbnailUri || photo.localUri }}
              style={styles.photo}
              resizeMode="cover"
            />
            {onRemovePhoto && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemovePhoto(photo.id)}
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
        ))}

        {showAddButton && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={onAddPhoto}
            activeOpacity={0.7}
          >
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {photos.length === 0 && !showAddButton && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyText}>No photos</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  photoContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: "#ffffff",
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
    color: "#ffffff",
    fontSize: 10,
  },
  addButton: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  addIcon: {
    fontSize: 28,
    color: "#9ca3af",
    marginBottom: 4,
  },
  addText: {
    fontSize: 12,
    color: "#6b7280",
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
    color: "#9ca3af",
  },
});

export default PhotoGrid;
