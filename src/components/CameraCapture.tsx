/**
 * CameraCapture Component
 * Full-screen camera with GPS overlay and photo type selection
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { CameraView, CameraType, FlashMode } from "expo-camera";
import {
  photoService,
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
  getGPSAccuracyStatus,
} from "../services/photo-service";
import { PhotoType } from "../types/shared";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CameraCaptureProps {
  reportId: string;
  defectId?: string;
  roofElementId?: string;
  onCapture: (photoId: string) => void;
  onClose: () => void;
}

const PHOTO_TYPES: { type: PhotoType; label: string; hint: string }[] = [
  { type: PhotoType.OVERVIEW, label: "Overview", hint: "Wide shot of the area" },
  { type: PhotoType.CONTEXT, label: "Context", hint: "Defect in context" },
  { type: PhotoType.DETAIL, label: "Detail", hint: "Close-up of defect" },
  { type: PhotoType.SCALE_REFERENCE, label: "Scale", hint: "With ruler/reference" },
];

export function CameraCapture({
  reportId,
  defectId,
  roofElementId,
  onCapture,
  onClose,
}: CameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("auto");
  const [selectedType, setSelectedType] = useState<PhotoType>(PhotoType.OVERVIEW);
  const [isCapturing, setIsCapturing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<{ accuracy: number; status: "none" | "good" | "fair" | "poor" }>({ accuracy: 999, status: "none" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string>("");

  // Start location tracking on mount
  useEffect(() => {
    startLocationTracking();

    // Update GPS status every second
    const interval = setInterval(() => {
      const status = getGPSAccuracyStatus();
      setGpsStatus(status);

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

    try {
      const result = await photoService.capturePhoto(
        cameraRef.current,
        selectedType,
        reportId,
        defectId,
        roofElementId
      );

      if (result.success && result.metadata) {
        onCapture(result.metadata.id);
        setCaptureStatus("Photo captured!");

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

  const toggleFlash = () => {
    setFlash((prev) => (prev === "off" ? "on" : prev === "on" ? "auto" : "off"));
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

  const getFlashIcon = () => {
    switch (flash) {
      case "on":
        return "⚡";
      case "off":
        return "⚡̶";
      default:
        return "⚡A";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.gpsContainer}>
            <View style={[styles.gpsDot, { backgroundColor: getGpsColor() }]} />
            <Text style={styles.gpsText}>
              GPS: {gpsStatus.status === "none" ? "No signal" : `±${Math.round(gpsStatus.accuracy)}m`}
            </Text>
          </View>

          <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
            <Text style={styles.flashButtonText}>{getFlashIcon()}</Text>
          </TouchableOpacity>
        </View>

        {/* Grid Overlay */}
        <View style={styles.gridOverlay}>
          <View style={styles.gridHorizontal1} />
          <View style={styles.gridHorizontal2} />
          <View style={styles.gridVertical1} />
          <View style={styles.gridVertical2} />
        </View>

        {/* GPS Coordinates Overlay */}
        {location && (
          <View style={styles.coordinatesOverlay}>
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

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
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

          {/* Capture Button */}
          <View style={styles.captureRow}>
            <View style={styles.spacer} />

            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
              onPress={handleCapture}
              disabled={isCapturing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <View style={styles.spacer} />
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 20,
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
  flashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  flashButtonText: {
    color: "#fff",
    fontSize: 16,
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
    bottom: 200,
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
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
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
    backgroundColor: "#2d5c8f",
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
  spacer: {
    flex: 1,
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
});

export default CameraCapture;
