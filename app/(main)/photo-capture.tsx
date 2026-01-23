/**
 * Photo Capture Screen
 * Wrapper screen for the CameraCapture component
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { CameraCapture } from "../../src/components/CameraCapture";
import { useLocalDB } from "../../src/hooks/useLocalDB";
import type { LocalPhoto } from "../../src/types/database";

export default function PhotoCaptureScreen() {
  const { reportId, defectId, roofElementId } = useLocalSearchParams<{
    reportId: string;
    defectId?: string;
    roofElementId?: string;
  }>();
  const router = useRouter();
  const { getPhotos, deletePhoto } = useLocalDB();

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
    loadPhotos();
  }, []);

  const checkPermissions = async () => {
    // Check location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === "granted");
  };

  const loadPhotos = async () => {
    if (!reportId) return;

    setIsLoading(true);
    try {
      const loadedPhotos = await getPhotos(reportId);
      // Filter by defect or element if provided
      let filtered = loadedPhotos;
      if (defectId) {
        filtered = loadedPhotos.filter((p) => p.defectId === defectId);
      } else if (roofElementId) {
        filtered = loadedPhotos.filter((p) => p.roofElementId === roofElementId);
      }
      setPhotos(filtered);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = (photoId: string) => {
    // Reload photos after capture
    loadPhotos();
  };

  const handleDeletePhoto = (photo: LocalPhoto) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePhoto(photo.id);
              loadPhotos();
            } catch (error) {
              console.error("Failed to delete photo:", error);
              Alert.alert("Error", "Failed to delete photo");
            }
          },
        },
      ]
    );
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to capture photos."
        );
        return;
      }
    }
    setShowCamera(true);
  };

  if (!reportId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Report ID is required</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showCamera) {
    return (
      <CameraCapture
        reportId={reportId}
        defectId={defectId}
        roofElementId={roofElementId}
        onCapture={handleCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  const renderPhotoItem = ({ item }: { item: LocalPhoto }) => (
    <TouchableOpacity
      style={styles.photoCard}
      onLongPress={() => handleDeletePhoto(item)}
    >
      <Image source={{ uri: item.localUri }} style={styles.photoImage} />
      <View style={styles.photoInfo}>
        <Text style={styles.photoType}>{item.photoType.replace(/_/g, " ")}</Text>
        <Text style={styles.photoTimestamp}>
          {item.capturedAt ? new Date(item.capturedAt).toLocaleTimeString() : ""}
        </Text>
        {item.gpsLat && item.gpsLng && (
          <Text style={styles.photoGps}>
            GPS: ±{item.gpsAccuracy?.toFixed(0)}m
          </Text>
        )}
      </View>
      {item.syncStatus === "captured" && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Photo Capture</Text>
        <Text style={styles.subtitle}>
          {defectId
            ? "Defect Photos"
            : roofElementId
            ? "Element Photos"
            : "Report Photos"}
        </Text>
      </View>

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

      {/* Photo Grid */}
      <FlatList
        data={photos}
        renderItem={renderPhotoItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.photoGrid}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to start capturing
            </Text>
          </View>
        }
        ListHeaderComponent={
          photos.length > 0 ? (
            <Text style={styles.photoCount}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""} captured
            </Text>
          ) : null
        }
      />

      {/* Capture Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.captureButton} onPress={openCamera}>
          <Text style={styles.captureButtonIcon}>📷</Text>
          <Text style={styles.captureButtonText}>Open Camera</Text>
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
    color: "#2d5c8f",
    fontSize: 16,
    marginBottom: 8,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#2d5c8f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
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
    color: "#2d5c8f",
    fontSize: 13,
    fontWeight: "600",
  },
  photoGrid: {
    padding: 8,
    paddingBottom: 100,
  },
  photoCount: {
    fontSize: 14,
    color: "#64748b",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  photoCard: {
    flex: 1,
    margin: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  photoImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#e2e8f0",
  },
  photoInfo: {
    padding: 8,
  },
  photoType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
    textTransform: "capitalize",
  },
  photoTimestamp: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  photoGps: {
    fontSize: 10,
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
    backgroundColor: "#2d5c8f",
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
