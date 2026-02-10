/**
 * CameraCapture Component
 * Full-screen camera with GPS overlay, photo type selection, quick tags, and element selector
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { CameraView, CameraType, FlashMode } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  photoService,
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
  getGPSAccuracyStatus,
} from "../services/photo-service";
import { PhotoType, QuickTag, ElementType } from "../types/shared";
import {
  validateCaptureLocation,
  isApproximateLocation,
  formatGPSAccuracy,
} from "../lib/location-utils";

export interface RoofElementOption {
  id: string;
  elementType: ElementType;
  location: string;
}

interface CameraCaptureProps {
  reportId: string;
  defectId?: string;
  roofElementId?: string;
  roofElements?: RoofElementOption[];
  propertyLocation?: { latitude: number; longitude: number };
  onCapture: (photoId: string, quickTag?: QuickTag, elementId?: string) => void;
  onClose: () => void;
}

const PHOTO_TYPES: { type: PhotoType; label: string; hint: string }[] = [
  { type: PhotoType.OVERVIEW, label: "Overview", hint: "Wide shot of the area" },
  { type: PhotoType.CONTEXT, label: "Context", hint: "Defect in context" },
  { type: PhotoType.DETAIL, label: "Detail", hint: "Close-up of defect" },
  { type: PhotoType.SCALE_REFERENCE, label: "Scale", hint: "With ruler/reference" },
];

const QUICK_TAGS: { tag: QuickTag; label: string; color: string }[] = [
  { tag: QuickTag.DEFECT, label: "Defect", color: "#ef4444" },
  { tag: QuickTag.GOOD, label: "Good", color: "#22c55e" },
  { tag: QuickTag.INACCESSIBLE, label: "N/A", color: "#6b7280" },
];

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

const FLASH_LABELS: Record<string, string> = {
  on: "ON",
  off: "OFF",
  auto: "AUTO",
};

export function CameraCapture({
  reportId,
  defectId,
  roofElementId: initialElementId,
  roofElements = [],
  propertyLocation,
  onCapture,
  onClose,
}: CameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("auto");
  const [selectedType, setSelectedType] = useState<PhotoType>(PhotoType.OVERVIEW);
  const [selectedQuickTag, setSelectedQuickTag] = useState<QuickTag | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(initialElementId || null);
  const [showElementPicker, setShowElementPicker] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<{ accuracy: number; status: "none" | "good" | "fair" | "poor" }>({ accuracy: 999, status: "none" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string>("");
  const [isApproximate, setIsApproximate] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  // Start location tracking on mount
  useEffect(() => {
    startLocationTracking();

    // Update GPS status every second
    const interval = setInterval(() => {
      const status = getGPSAccuracyStatus();
      setGpsStatus(status);

      // Check for iOS approximate location
      setIsApproximate(isApproximateLocation(status.accuracy));

      const loc = getCurrentLocation();
      if (loc) {
        setLocation({ lat: loc.latitude, lng: loc.longitude });
      }
    }, 1000);

    // Register progress callback
    photoService.onCaptureProgress((status) => {
      setCaptureStatus(status);
    });

    return () => {
      clearInterval(interval);
      stopLocationTracking();
    };
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    setCaptureStatus("Capturing...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Validate location if property location is provided
    if (propertyLocation && location) {
      const validation = validateCaptureLocation(
        { latitude: location.lat, longitude: location.lng },
        propertyLocation,
        500 // 500m threshold
      );

      if (!validation.isValid && validation.distanceMeters !== null) {
        // Show warning but don't block capture
        setLocationWarning(`Photo captured ${validation.distanceMeters}m from property location`);
        // Auto-dismiss after 5 seconds
        setTimeout(() => setLocationWarning(null), 5000);
      }
    }

    try {
      const result = await photoService.capturePhoto(
        cameraRef.current,
        selectedType,
        reportId,
        defectId,
        selectedElementId || undefined,
        selectedQuickTag || undefined
      );

      if (result.success && result.metadata) {
        setPhotoCount((prev) => prev + 1);
        onCapture(result.metadata.id, selectedQuickTag || undefined, selectedElementId || undefined);
        setCaptureStatus("Photo captured!");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Auto-advance to next photo type
        const currentIndex = PHOTO_TYPES.findIndex((t) => t.type === selectedType);
        if (currentIndex < PHOTO_TYPES.length - 1) {
          setSelectedType(PHOTO_TYPES[currentIndex + 1].type);
        }
      } else {
        setCaptureStatus(result.error || "Capture failed");
      }
    } catch (error) {
      setCaptureStatus("Error capturing photo");
      console.error("Capture error:", error);
    } finally {
      setIsCapturing(false);
      setTimeout(() => setCaptureStatus(""), 2000);
    }
  };

  const getSelectedElementLabel = (): string => {
    if (!selectedElementId) return "Select Element";
    const element = roofElements.find((e) => e.id === selectedElementId);
    if (!element) return "Select Element";
    return `${ELEMENT_TYPE_LABELS[element.elementType]} - ${element.location}`;
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === "off" ? "on" : prev === "on" ? "auto" : "off"));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const getGpsColor = () => {
    switch (gpsStatus.status) {
      case "good":
        return "#22c55e";
      case "fair":
        return "#f59e0b";
      case "poor":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera fills the background — no children so it doesn't swallow touches */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        flash={flash}
      />

      {/* All UI overlays rendered OUTSIDE CameraView so touches work reliably */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Grid Overlay (non-interactive) */}
        <View style={styles.gridOverlay} pointerEvents="none">
          <View style={styles.gridHorizontal1} />
          <View style={styles.gridHorizontal2} />
          <View style={styles.gridVertical1} />
          <View style={styles.gridVertical2} />
        </View>

        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.topBarButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.gpsContainer}>
            <View style={[styles.gpsDot, { backgroundColor: getGpsColor() }]} />
            <Text style={styles.gpsText}>
              GPS: {gpsStatus.status === "none" ? "No signal" : `±${Math.round(gpsStatus.accuracy)}m`}
            </Text>
            {isApproximate && (
              <Text style={styles.approximateWarning}>APPROX</Text>
            )}
          </View>

          <TouchableOpacity style={styles.topBarButton} onPress={toggleFlash}>
            <Text style={styles.flashLabelIcon}>⚡</Text>
            <Text style={styles.flashLabelText}>{FLASH_LABELS[flash] || "AUTO"}</Text>
          </TouchableOpacity>
        </View>

        {/* GPS Coordinates Overlay — positioned below top bar */}
        {location && (
          <View style={[styles.coordinatesOverlay, { top: insets.top + 64 }]}>
            <Text style={styles.coordinatesText}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Text>
            <Text style={styles.timestampText}>
              {new Date().toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Capture Status */}
        {captureStatus && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>{captureStatus}</Text>
          </View>
        )}

        {/* Location Warning Overlay */}
        {locationWarning && (
          <View style={[styles.locationWarningOverlay, { top: insets.top + 100 }]}>
            <Text style={styles.locationWarningText}>{locationWarning}</Text>
          </View>
        )}

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
          {/* Element Selector (if elements available) */}
          {roofElements.length > 0 && (
            <TouchableOpacity
              style={styles.elementSelector}
              onPress={() => setShowElementPicker(true)}
            >
              <Text style={styles.elementSelectorLabel}>Element:</Text>
              <Text style={styles.elementSelectorValue} numberOfLines={1}>
                {getSelectedElementLabel()}
              </Text>
              <Text style={styles.elementSelectorArrow}>▼</Text>
            </TouchableOpacity>
          )}

          {/* Quick Tags */}
          <View style={styles.quickTagContainer}>
            <Text style={styles.quickTagLabel}>Tag:</Text>
            <View style={styles.quickTagButtons}>
              {QUICK_TAGS.map((qt) => (
                <TouchableOpacity
                  key={qt.tag}
                  style={[
                    styles.quickTagButton,
                    selectedQuickTag === qt.tag && { backgroundColor: qt.color },
                  ]}
                  onPress={() =>
                    setSelectedQuickTag(selectedQuickTag === qt.tag ? null : qt.tag)
                  }
                >
                  <Text
                    style={[
                      styles.quickTagButtonText,
                      selectedQuickTag === qt.tag && styles.quickTagButtonTextActive,
                    ]}
                  >
                    {qt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Photo Type Selector */}
          <View style={styles.typeSelector}>
            {PHOTO_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt.type}
                style={[
                  styles.typeButton,
                  selectedType === pt.type && styles.typeButtonActive,
                ]}
                onPress={() => setSelectedType(pt.type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    selectedType === pt.type && styles.typeButtonTextActive,
                  ]}
                >
                  {pt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hint text */}
          <Text style={styles.hintText}>
            {PHOTO_TYPES.find((t) => t.type === selectedType)?.hint}
          </Text>

          {/* Capture Row: flip camera | shutter | photo count */}
          <View style={styles.captureRow}>
            <View style={styles.captureRowSide}>
              <TouchableOpacity style={styles.flipButton} onPress={toggleFacing}>
                <Text style={styles.flipButtonText}>↻</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
              onPress={handleCapture}
              disabled={isCapturing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <View style={styles.captureRowSide}>
              {photoCount > 0 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountText}>{photoCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Element Picker Modal — outside both camera and overlay views */}
      <Modal
        visible={showElementPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowElementPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Roof Element</Text>
              <TouchableOpacity onPress={() => setShowElementPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: null, elementType: null, location: "None" }, ...roofElements]}
              keyExtractor={(item) => item.id || "none"}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.elementOption,
                    selectedElementId === item.id && styles.elementOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedElementId(item.id);
                    setShowElementPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.elementOptionText,
                      selectedElementId === item.id && styles.elementOptionTextSelected,
                    ]}
                  >
                    {item.elementType
                      ? `${ELEMENT_TYPE_LABELS[item.elementType]} - ${item.location}`
                      : "None (General Photo)"}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  topBarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "300",
  },
  flashLabelIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  flashLabelText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  gpsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gpsText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  approximateWarning: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 4,
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridHorizontal1: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "33.33%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  gridHorizontal2: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "66.66%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  gridVertical1: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "33.33%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  gridVertical2: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "66.66%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  coordinatesOverlay: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  coordinatesText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "monospace",
  },
  timestampText: {
    color: "#ccc",
    fontSize: 9,
    fontFamily: "monospace",
  },
  statusOverlay: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationWarningOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(234,88,12,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  locationWarningText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  typeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  typeButtonActive: {
    backgroundColor: "#3c4b5d",
  },
  typeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  typeButtonTextActive: {
    fontWeight: "700",
  },
  hintText: {
    color: "#ccc",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  captureRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  captureRowSide: {
    flex: 1,
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  flipButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
  },
  photoCountBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  photoCountText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  // Element Selector
  elementSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  elementSelectorLabel: {
    color: "#ccc",
    fontSize: 12,
    marginRight: 8,
  },
  elementSelectorValue: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  elementSelectorArrow: {
    color: "#ccc",
    fontSize: 10,
    marginLeft: 4,
  },
  // Quick Tags
  quickTagContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickTagLabel: {
    color: "#ccc",
    fontSize: 12,
    marginRight: 8,
  },
  quickTagButtons: {
    flexDirection: "row",
    gap: 8,
  },
  quickTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  quickTagButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  quickTagButtonTextActive: {
    fontWeight: "700",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalClose: {
    color: "#fff",
    fontSize: 20,
    padding: 4,
  },
  elementOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  elementOptionSelected: {
    backgroundColor: "#3c4b5d",
  },
  elementOptionText: {
    color: "#fff",
    fontSize: 14,
  },
  elementOptionTextSelected: {
    fontWeight: "600",
  },
});

export default CameraCapture;
