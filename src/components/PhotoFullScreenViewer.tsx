/**
 * PhotoFullScreenViewer Component
 * Full-screen photo viewer with pinch-to-zoom and swipe navigation
 *
 * Features:
 * - ImageZoom component for pinch-to-zoom (1x min, 5x max, 2x double-tap)
 * - FlatList horizontal swipe navigation between photos
 * - Metadata overlay with photo info and quick actions
 * - Toggle overlay visibility on tap
 * - Header with close button and photo counter
 */

import React, { useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  FlatList,
} from "react-native";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import type { LocalPhoto } from "../types/database";
import {
  COLORS,
  BORDER_RADIUS,
  TOUCH_TARGET,
  SPACING,
  PHOTO_TYPE_COLORS,
} from "../lib/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================
// TYPES
// ============================================

interface PhotoFullScreenViewerProps {
  photos: LocalPhoto[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onAnnotate?: (photo: LocalPhoto) => void;
  onEdit?: (photo: LocalPhoto) => void;
  onViewDetails?: (photo: LocalPhoto) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "Unknown";
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-NZ", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Invalid date";
  }
}

function formatPhotoType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatQuickTag(tag: string | null): string | null {
  if (!tag) return null;
  return tag
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCoordinates(
  lat: number | null,
  lng: number | null
): string | null {
  if (lat === null || lng === null) return null;
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}${latDir}, ${Math.abs(lng).toFixed(4)}${lngDir}`;
}

function hasAnnotations(photo: LocalPhoto): boolean {
  if (!photo.annotationsJson) return false;
  try {
    const annotations = JSON.parse(photo.annotationsJson);
    return Array.isArray(annotations) && annotations.length > 0;
  } catch {
    return false;
  }
}

// ============================================
// PHOTO ITEM COMPONENT
// ============================================

interface PhotoItemProps {
  photo: LocalPhoto;
  onSingleTap: () => void;
}

function PhotoItem({ photo, onSingleTap }: PhotoItemProps) {
  return (
    <View style={styles.photoItemContainer}>
      <ImageZoom
        uri={photo.localUri}
        minScale={1}
        maxScale={5}
        doubleTapScale={2}
        isDoubleTapEnabled={true}
        isSingleTapEnabled={true}
        onSingleTap={onSingleTap}
        style={styles.imageZoom}
      />
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PhotoFullScreenViewer({
  photos,
  initialIndex,
  visible,
  onClose,
  onAnnotate,
  onEdit,
  onViewDetails,
}: PhotoFullScreenViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOverlay, setShowOverlay] = useState(true);
  const flatListRef = useRef<FlatList<LocalPhoto>>(null);

  // Reset index when modal opens
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setShowOverlay(true);
    }
  }, [visible, initialIndex]);

  const handleToggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
  }, []);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const currentPhoto = photos[currentIndex];

  const handleAnnotate = useCallback(() => {
    if (onAnnotate && currentPhoto) {
      onAnnotate(currentPhoto);
    }
  }, [onAnnotate, currentPhoto]);

  const handleEdit = useCallback(() => {
    if (onEdit && currentPhoto) {
      onEdit(currentPhoto);
    }
  }, [onEdit, currentPhoto]);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails && currentPhoto) {
      onViewDetails(currentPhoto);
    }
  }, [onViewDetails, currentPhoto]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: LocalPhoto }) => (
      <PhotoItem photo={item} onSingleTap={handleToggleOverlay} />
    ),
    [handleToggleOverlay]
  );

  const keyExtractor = useCallback((item: LocalPhoto) => item.id, []);

  if (!currentPhoto) return null;

  const photoTypeColor =
    PHOTO_TYPE_COLORS[currentPhoto.photoType as keyof typeof PHOTO_TYPE_COLORS] ||
    COLORS.gray[500];
  const gpsCoords = formatCoordinates(currentPhoto.gpsLat, currentPhoto.gpsLng);
  const photoHasAnnotations = hasAnnotations(currentPhoto);
  const quickTag = formatQuickTag(currentPhoto.quickTag);

  // Calculate safe area padding for iOS
  const topPadding = Platform.OS === "ios" ? 54 : StatusBar.currentHeight ?? 44;
  const bottomPadding = Platform.OS === "ios" ? 34 : 16;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Photo Gallery */}
        <FlatList
          ref={flatListRef}
          data={photos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={styles.flatList}
          accessibilityRole="list"
          accessibilityLabel={`Photo gallery, ${photos.length} photos. Swipe left or right to navigate.`}
        />

        {/* Header Overlay */}
        {showOverlay && (
          <View style={[styles.headerOverlay, { paddingTop: topPadding }]}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.photoCounter} accessibilityRole="text">
              {currentIndex + 1} / {photos.length}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        )}

        {/* Metadata Overlay */}
        {showOverlay && (
          <View style={[styles.metadataOverlay, { paddingBottom: bottomPadding }]}>
            {/* Photo Info Row */}
            <View style={styles.metadataRow}>
              {/* Photo Type Badge */}
              <View style={[styles.badge, { backgroundColor: photoTypeColor + "20" }]}>
                <Text style={[styles.badgeText, { color: photoTypeColor }]}>
                  {formatPhotoType(currentPhoto.photoType)}
                </Text>
              </View>

              {/* Quick Tag Badge */}
              {quickTag && (
                <View style={[styles.badge, styles.quickTagBadge]}>
                  <Text style={styles.quickTagText}>{quickTag}</Text>
                </View>
              )}

              {/* Annotation Indicator */}
              {photoHasAnnotations && (
                <View style={[styles.badge, styles.annotationBadge]}>
                  <Text style={styles.annotationBadgeText}>Annotated</Text>
                </View>
              )}
            </View>

            {/* Capture Details */}
            <View style={styles.captureDetails}>
              <Text style={styles.captureDate}>
                {formatDateTime(currentPhoto.capturedAt)}
              </Text>
              {gpsCoords && <Text style={styles.gpsText}>{gpsCoords}</Text>}
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              {onAnnotate && (
                <TouchableOpacity
                  onPress={handleAnnotate}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel="Annotate this photo"
                >
                  <Text style={styles.actionButtonText}>Annotate</Text>
                </TouchableOpacity>
              )}
              {onEdit && (
                <TouchableOpacity
                  onPress={handleEdit}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel="Edit photo classification"
                >
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
              {onViewDetails && (
                <TouchableOpacity
                  onPress={handleViewDetails}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel="View full photo details"
                >
                  <Text style={styles.actionButtonText}>Details</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
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
    backgroundColor: COLORS.black,
  },
  flatList: {
    flex: 1,
  },
  photoItemContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  imageZoom: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  closeButton: {
    minWidth: 60,
    minHeight: TOUCH_TARGET.minimum,
    justifyContent: "center",
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "500",
  },
  photoCounter: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 60,
  },
  metadataOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  metadataRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  badge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  quickTagBadge: {
    backgroundColor: COLORS.gray[700],
  },
  quickTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray[200],
  },
  annotationBadge: {
    backgroundColor: COLORS.accent[500] + "30",
  },
  annotationBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent[300],
  },
  captureDetails: {
    marginBottom: SPACING.lg,
  },
  captureDate: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: SPACING.xs,
  },
  gpsText: {
    color: COLORS.gray[400],
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.primary[500],
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    minHeight: TOUCH_TARGET.minimum,
    justifyContent: "center",
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default PhotoFullScreenViewer;
