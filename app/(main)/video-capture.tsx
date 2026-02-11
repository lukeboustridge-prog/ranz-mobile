/**
 * Video Capture Screen
 * Wrapper screen for the VideoCapture component
 *
 * Supports two entry modes:
 * 1. Direct navigation with reportId param (existing flow from report detail)
 * 2. Quick capture without reportId (shows ReportPickerModal on mount)
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { VideoCapture } from "../../src/components/VideoCapture";
import { ReportPickerModal } from "../../src/components/ReportPickerModal";
import { OfflineIndicator } from "../../src/components/OfflineIndicator";
import type { LocalVideo } from "../../src/types/database";

export default function VideoCaptureScreen() {
  const { reportId, defectId, roofElementId } = useLocalSearchParams<{
    reportId: string;
    defectId?: string;
    roofElementId?: string;
  }>();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [videos, setVideos] = useState<LocalVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Report picker state (for quick capture mode without reportId param)
  const [showReportPicker, setShowReportPicker] = useState(!reportId);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Determine the effective reportId (param takes precedence over picker selection)
  const effectiveReportId = reportId || selectedReportId;

  // Track if user navigated via direct route (with reportId param)
  const isDirectNavigation = !!reportId;

  useEffect(() => {
    checkPermissions();
  }, []);

  // Load videos when effective reportId changes
  useEffect(() => {
    if (effectiveReportId) {
      loadVideos();
    }
  }, [effectiveReportId]);

  const checkPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === "granted");
  };

  const loadVideos = async () => {
    if (!effectiveReportId) return;

    setIsLoading(true);
    try {
      const sqlite = await import("../../src/lib/sqlite");
      const loadedVideos = await sqlite.getVideosForReport(effectiveReportId);
      // Filter by defect or element if provided
      let filtered = loadedVideos;
      if (defectId) {
        filtered = loadedVideos.filter((v) => v.defectId === defectId);
      } else if (roofElementId) {
        filtered = loadedVideos.filter((v) => v.roofElementId === roofElementId);
      }
      setVideos(filtered);
    } catch (error) {
      console.error("Failed to load videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = useCallback(() => {
    loadVideos();
  }, [effectiveReportId, defectId, roofElementId]);

  const openRecorder = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to record videos."
        );
        return;
      }
    }
    setShowRecorder(true);
  };

  // Handle report selection from picker
  const handleReportSelect = (selectedId: string) => {
    setSelectedReportId(selectedId);
    setShowReportPicker(false);
  };

  // Handle close picker without selection
  const handleClosePicker = () => {
    setShowReportPicker(false);
    if (!selectedReportId && !reportId) {
      router.back();
    }
  };

  // Handle create new report from picker
  const handleCreateNewReport = () => {
    setShowReportPicker(false);
    router.push("/(main)/new-report");
  };

  // Handle change report button (only visible in quick capture mode)
  const handleChangeReport = () => {
    setShowReportPicker(true);
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Show error state if no report selected after closing picker
  if (!effectiveReportId && !showReportPicker) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No report selected</Text>
        <Text style={styles.errorSubtext}>
          Please select a report to record videos
        </Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity
            style={styles.selectReportButton}
            onPress={() => setShowReportPicker(true)}
          >
            <Text style={styles.selectReportButtonText}>Select Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (showRecorder && effectiveReportId) {
    return (
      <VideoCapture
        reportId={effectiveReportId}
        defectId={defectId}
        roofElementId={roofElementId}
        onCapture={handleCapture}
        onClose={() => setShowRecorder(false)}
      />
    );
  }

  const renderVideoItem = ({ item }: { item: LocalVideo }) => (
    <TouchableOpacity
      style={styles.videoCard}
      accessibilityRole="button"
      accessibilityLabel={`Video recorded ${item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString() : ""}`}
    >
      <View style={styles.videoThumbnail}>
        <Text style={styles.videoThumbnailIcon}>🎬</Text>
        <Text style={styles.videoDuration}>{formatDuration(item.durationMs)}</Text>
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={1}>
          {item.title || item.originalFilename}
        </Text>
        <Text style={styles.videoTimestamp}>
          {item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString() : ""}
        </Text>
        {item.gpsLat && item.gpsLng && (
          <Text style={styles.videoGps}>GPS tagged</Text>
        )}
      </View>
      {item.syncStatus !== "synced" && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Report Picker Modal */}
      <ReportPickerModal
        visible={showReportPicker}
        onSelect={handleReportSelect}
        onClose={handleClosePicker}
        onCreateNew={handleCreateNewReport}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          {!isDirectNavigation && selectedReportId && (
            <TouchableOpacity
              style={styles.changeReportButton}
              onPress={handleChangeReport}
            >
              <Text style={styles.changeReportText}>Change Report</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.title}>Video Capture</Text>
        <Text style={styles.subtitle}>
          {defectId
            ? "Defect Videos"
            : roofElementId
            ? "Element Videos"
            : "Report Videos"}
        </Text>
      </View>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Permission Warnings */}
      {!permission?.granted && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>Camera permission required</Text>
          <TouchableOpacity onPress={requestPermission}>
            <Text style={styles.warningAction}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      )}

      {!locationPermission && (
        <View style={[styles.warningBanner, styles.warningBannerAmber]}>
          <Text style={styles.warningTextAmber}>
            Location disabled - GPS data will not be captured
          </Text>
        </View>
      )}

      {/* Video List */}
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.videoList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎥</Text>
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to start recording
            </Text>
          </View>
        }
        ListHeaderComponent={
          videos.length > 0 ? (
            <Text style={styles.videoCount}>
              {videos.length} video{videos.length !== 1 ? "s" : ""} recorded
            </Text>
          ) : null
        }
      />

      {/* Record Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.captureButton} onPress={openRecorder}>
          <Text style={styles.captureButtonIcon}>🎥</Text>
          <Text style={styles.captureButtonText}>Record Video</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backLink: {
    color: "#3c4b5d",
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  changeReportButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e8eef6",
    borderRadius: 6,
  },
  changeReportText: {
    color: "#3c4b5d",
    fontSize: 13,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#1e293b",
    marginBottom: 8,
    fontWeight: "600",
  },
  errorSubtext: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  errorButtons: {
    gap: 12,
  },
  selectReportButton: {
    backgroundColor: "#3c4b5d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 160,
    alignItems: "center",
  },
  selectReportButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 160,
    alignItems: "center",
  },
  backButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  warningBanner: {
    backgroundColor: "#fef2f2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  warningBannerAmber: {
    backgroundColor: "#fffbeb",
    borderBottomColor: "#fde68a",
  },
  warningText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
  },
  warningTextAmber: {
    color: "#d97706",
    fontSize: 13,
    fontWeight: "500",
  },
  warningAction: {
    color: "#3c4b5d",
    fontSize: 13,
    fontWeight: "600",
  },
  videoList: {
    padding: 16,
    paddingBottom: 100,
  },
  videoCount: {
    fontSize: 14,
    color: "#64748b",
    paddingBottom: 12,
  },
  videoCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  videoThumbnail: {
    width: 80,
    height: 80,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  videoThumbnailIcon: {
    fontSize: 28,
  },
  videoDuration: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  videoInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  videoTimestamp: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  videoGps: {
    fontSize: 11,
    color: "#22c55e",
    marginTop: 2,
  },
  pendingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  captureButton: {
    backgroundColor: "#3c4b5d",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  captureButtonIcon: {
    fontSize: 20,
  },
  captureButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
