/**
 * PhotoDetailModal Component
 * Full-screen photo viewer with comprehensive metadata display
 *
 * Displays photo with all evidence metadata including:
 * - GPS coordinates and accuracy
 * - Capture timestamp
 * - Camera make/model and EXIF data
 * - Evidence hash (SHA-256)
 * - Sync status
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import type { LocalPhoto } from "../types/database";
import { COLORS, BORDER_RADIUS, TOUCH_TARGET, SPACING } from "../lib/theme";
import { PhotoEditSheet } from "./PhotoEditSheet";
import { useLocalDB } from "../hooks/useLocalDB";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================
// TYPES
// ============================================

interface PhotoDetailModalProps {
  photo: LocalPhoto | null;
  visible: boolean;
  onClose: () => void;
  onEdit?: (photo: LocalPhoto) => void;
  onDelete?: (photo: LocalPhoto) => void;
}

// ============================================
// SYNC STATUS COLORS
// ============================================

const SYNC_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  captured: { bg: "#fef3c7", text: "#d97706", label: "Pending Upload" },
  processing: { bg: "#dbeafe", text: "#2563eb", label: "Processing" },
  uploaded: { bg: "#dcfce7", text: "#16a34a", label: "Uploaded" },
  synced: { bg: "#dcfce7", text: "#059669", label: "Synced" },
  error: { bg: "#fee2e2", text: "#dc2626", label: "Sync Error" },
};

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCoordinate(value: number | null, type: "lat" | "lng"): string {
  if (value === null || value === undefined) return "N/A";
  const abs = Math.abs(value);
  const direction = type === "lat" ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  return `${abs.toFixed(6)}° ${direction}`;
}

function formatExposureTime(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  if (value >= 1) return `${value.toFixed(1)}s`;
  const denominator = Math.round(1 / value);
  return `1/${denominator}s`;
}

function formatPhotoType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatQuickTag(tag: string | null): string | null {
  if (!tag) return null;
  return tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function truncateHash(hash: string, length: number = 16): string {
  if (hash.length <= length) return hash;
  return `${hash.substring(0, length)}...`;
}

// ============================================
// METADATA ROW COMPONENT
// ============================================

interface MetadataRowProps {
  label: string;
  value: string | null;
  onCopy?: () => void;
  copyable?: boolean;
}

function MetadataRow({ label, value, onCopy, copyable }: MetadataRowProps) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <View style={styles.metadataValueContainer}>
        <Text style={styles.metadataValue} numberOfLines={1} ellipsizeMode="middle">
          {value || "N/A"}
        </Text>
        {copyable && onCopy && (
          <TouchableOpacity
            onPress={onCopy}
            style={styles.copyButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}
          >
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================
// SECTION COMPONENT
// ============================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PhotoDetailModal({
  photo: initialPhoto,
  visible,
  onClose,
  onEdit,
  onDelete,
}: PhotoDetailModalProps) {
  const [hashCopied, setHashCopied] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<LocalPhoto | null>(initialPhoto);
  const { updatePhotoClassification, getPhotoById } = useLocalDB();

  // Sync currentPhoto with initialPhoto when modal opens/closes
  React.useEffect(() => {
    setCurrentPhoto(initialPhoto);
  }, [initialPhoto, visible]);

  const handleCopyHash = useCallback(async () => {
    if (!currentPhoto?.originalHash) return;
    await Clipboard.setStringAsync(currentPhoto.originalHash);
    setHashCopied(true);
    setTimeout(() => setHashCopied(false), 2000);
  }, [currentPhoto?.originalHash]);

  const handleDelete = useCallback(() => {
    if (currentPhoto && onDelete) {
      onDelete(currentPhoto);
    }
  }, [currentPhoto, onDelete]);

  const handleOpenEditSheet = useCallback(() => {
    setShowEditSheet(true);
  }, []);

  const handleCloseEditSheet = useCallback(() => {
    setShowEditSheet(false);
  }, []);

  const handleSaveClassification = useCallback(async (updates: {
    photoType: string;
    quickTag: string | null;
    caption: string | null;
  }) => {
    if (!currentPhoto) return;

    await updatePhotoClassification(currentPhoto.id, updates);

    // Refresh photo data to show updated values
    const refreshedPhoto = await getPhotoById(currentPhoto.id);
    if (refreshedPhoto) {
      setCurrentPhoto(refreshedPhoto);
    }
  }, [currentPhoto, updatePhotoClassification, getPhotoById]);

  if (!currentPhoto) return null;

  // Use currentPhoto instead of photo for display
  const photo = currentPhoto;

  const syncStatus = SYNC_STATUS_COLORS[photo.syncStatus] || SYNC_STATUS_COLORS.captured;
  const hasGps = photo.gpsLat !== null && photo.gpsLng !== null;
  const hasCamera = photo.cameraMake || photo.cameraModel;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close photo details"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photo Details</Text>
          <TouchableOpacity
            onPress={handleOpenEditSheet}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Edit photo classification"
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Photo */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: photo.localUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>

        {/* Metadata Panel */}
        <ScrollView
          style={styles.metadataPanel}
          contentContainerStyle={styles.metadataPanelContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Sync Status Badge */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: syncStatus.bg }]}>
              <Text style={[styles.statusText, { color: syncStatus.text }]}>
                {syncStatus.label}
              </Text>
            </View>
            <View style={styles.photoTypeBadge}>
              <Text style={styles.photoTypeText}>{formatPhotoType(photo.photoType)}</Text>
            </View>
            {photo.quickTag && (
              <View style={styles.quickTagBadge}>
                <Text style={styles.quickTagText}>{formatQuickTag(photo.quickTag)}</Text>
              </View>
            )}
          </View>

          {/* Evidence Info */}
          <Section title="Evidence Integrity">
            <MetadataRow
              label="Hash (SHA-256)"
              value={hashCopied ? "Copied!" : truncateHash(photo.originalHash)}
              copyable
              onCopy={handleCopyHash}
            />
            <MetadataRow label="Sync Status" value={syncStatus.label} />
            {photo.lastSyncError && (
              <MetadataRow label="Last Error" value={photo.lastSyncError} />
            )}
          </Section>

          {/* Capture Details */}
          <Section title="Capture Details">
            <MetadataRow label="Captured" value={formatDateTime(photo.capturedAt)} />
            <MetadataRow label="Photo Type" value={formatPhotoType(photo.photoType)} />
            {photo.quickTag && (
              <MetadataRow label="Quick Tag" value={formatQuickTag(photo.quickTag)} />
            )}
            {photo.caption && (
              <MetadataRow label="Caption" value={photo.caption} />
            )}
          </Section>

          {/* Location */}
          <Section title="Location">
            {hasGps ? (
              <>
                <MetadataRow label="Latitude" value={formatCoordinate(photo.gpsLat, "lat")} />
                <MetadataRow label="Longitude" value={formatCoordinate(photo.gpsLng, "lng")} />
                {photo.gpsAccuracy !== null && (
                  <MetadataRow label="Accuracy" value={`+/- ${photo.gpsAccuracy.toFixed(0)}m`} />
                )}
                {photo.gpsAltitude !== null && (
                  <MetadataRow label="Altitude" value={`${photo.gpsAltitude.toFixed(1)}m`} />
                )}
              </>
            ) : (
              <Text style={styles.noDataText}>GPS data not available</Text>
            )}
          </Section>

          {/* Camera */}
          <Section title="Camera">
            {hasCamera ? (
              <>
                {photo.cameraMake && <MetadataRow label="Make" value={photo.cameraMake} />}
                {photo.cameraModel && <MetadataRow label="Model" value={photo.cameraModel} />}
                {photo.exposureTime !== null && (
                  <MetadataRow label="Exposure" value={formatExposureTime(photo.exposureTime)} />
                )}
                {photo.fNumber !== null && (
                  <MetadataRow label="Aperture" value={`f/${photo.fNumber.toFixed(1)}`} />
                )}
                {photo.iso !== null && (
                  <MetadataRow label="ISO" value={photo.iso.toString()} />
                )}
                {photo.focalLength !== null && (
                  <MetadataRow label="Focal Length" value={`${photo.focalLength.toFixed(0)}mm`} />
                )}
              </>
            ) : (
              <Text style={styles.noDataText}>Camera EXIF data not available</Text>
            )}
          </Section>

          {/* File Info */}
          <Section title="File Information">
            <MetadataRow label="Filename" value={photo.filename} />
            <MetadataRow label="Original" value={photo.originalFilename} />
            <MetadataRow label="Type" value={photo.mimeType} />
            <MetadataRow label="Size" value={formatFileSize(photo.fileSize)} />
          </Section>

          {/* Actions */}
          {onDelete && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
              >
                <Text style={styles.deleteButtonText}>Delete Photo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Edit Sheet */}
        <PhotoEditSheet
          photo={currentPhoto}
          visible={showEditSheet}
          onClose={handleCloseEditSheet}
          onSave={handleSaveClassification}
        />
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
    backgroundColor: COLORS.gray[900],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : StatusBar.currentHeight ?? 44,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.gray[900],
  },
  closeButton: {
    minWidth: 60,
  },
  closeButtonText: {
    color: COLORS.primary[400],
    fontSize: 16,
    fontWeight: "500",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "600",
  },
  editButton: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  editButtonText: {
    color: COLORS.primary[400],
    fontSize: 16,
    fontWeight: "500",
  },
  imageContainer: {
    height: SCREEN_HEIGHT * 0.4,
    backgroundColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  metadataPanel: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    marginTop: -BORDER_RADIUS.xl,
  },
  metadataPanelContent: {
    padding: SPACING.xl,
  },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  photoTypeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary[100],
  },
  photoTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary[700],
  },
  quickTagBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
  },
  quickTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray[600],
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  sectionContent: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  metadataLabel: {
    fontSize: 14,
    color: COLORS.gray[600],
    flex: 1,
  },
  metadataValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 2,
    justifyContent: "flex-end",
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.gray[900],
    textAlign: "right",
  },
  copyButton: {
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary[100],
    borderRadius: BORDER_RADIUS.sm,
  },
  copyButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary[600],
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.gray[400],
    fontStyle: "italic",
    paddingVertical: SPACING.sm,
  },
  actionsContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
    minHeight: TOUCH_TARGET.recommended,
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 40,
  },
});

export default PhotoDetailModal;
