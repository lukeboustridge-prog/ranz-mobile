/**
 * VideoCapture Component
 * Full-screen video recording with GPS overlay and duration display
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import {
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
  getGPSAccuracyStatus,
} from "../services/photo-service";
import {
  videoService,
  formatVideoDuration,
  type VideoMetadata,
} from "../services/video-service";

interface VideoCaptureProps {
  reportId: string;
  defectId?: string;
  roofElementId?: string;
  onCapture: (video: VideoMetadata) => void;
  onClose: () => void;
}

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function VideoCapture({
  reportId,
  defectId,
  roofElementId,
  onCapture,
  onClose,
}: VideoCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [facing] = useState<CameraType>("back");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<{
    accuracy: number;
    status: "none" | "good" | "fair" | "poor";
  }>({ accuracy: 999, status: "none" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

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
    videoService.onRecordingProgress((durationMs) => {
      setRecordingDuration(durationMs);

      // Auto-stop at max duration
      if (durationMs >= MAX_DURATION_MS) {
        handleStopRecording();
      }
    });

    return () => {
      clearInterval(interval);
      stopLocationTracking();

      // Cancel recording if component unmounts while recording
      if (videoService.getIsRecording() && cameraRef.current) {
        videoService.cancelRecording(cameraRef.current);
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (!cameraRef.current || isLoading) return;

    setIsLoading(true);
    try {
      const started = await videoService.startRecording(
        cameraRef.current,
        reportId,
        defectId,
        roofElementId
      );

      if (started) {
        setIsRecording(true);
        setRecordingDuration(0);
      } else {
        Alert.alert("Error", "Failed to start recording");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start recording");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRecording = async () => {
    if (!cameraRef.current || isLoading) return;

    setIsLoading(true);
    try {
      const result = await videoService.stopRecording(
        cameraRef.current,
        reportId,
        defectId,
        roofElementId
      );

      setIsRecording(false);
      setRecordingDuration(0);

      if (result.success && result.metadata) {
        onCapture(result.metadata);
      } else {
        Alert.alert("Error", result.error || "Failed to save recording");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to stop recording");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRecording = async () => {
    if (!cameraRef.current) return;

    Alert.alert("Discard Recording", "Are you sure you want to discard this recording?", [
      { text: "Keep Recording", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          await videoService.cancelRecording(cameraRef.current!);
          setIsRecording(false);
          setRecordingDuration(0);
        },
      },
    ]);
  };

  const handleClose = () => {
    if (isRecording) {
      Alert.alert("Recording in Progress", "Please stop recording before closing.", [
        { text: "OK" },
      ]);
      return;
    }
    onClose();
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

  const getProgressPercentage = () => {
    return Math.min((recordingDuration / MAX_DURATION_MS) * 100, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isRecording}
          >
            <Text style={[styles.closeButtonText, isRecording && styles.buttonDisabled]}>
              ✕
            </Text>
          </TouchableOpacity>

          <View style={styles.gpsContainer}>
            <View style={[styles.gpsDot, { backgroundColor: getGpsColor() }]} />
            <Text style={styles.gpsText}>
              GPS:{" "}
              {gpsStatus.status === "none"
                ? "No signal"
                : `±${Math.round(gpsStatus.accuracy)}m`}
            </Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
            <Text style={styles.durationText}>
              {formatVideoDuration(recordingDuration)}
            </Text>
          </View>
        )}

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

        {/* Progress Bar (when recording) */}
        {isRecording && (
          <View style={styles.progressBarContainer}>
            <View
              style={[styles.progressBar, { width: `${getProgressPercentage()}%` }]}
            />
          </View>
        )}

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {/* Instructions */}
          <Text style={styles.instructionText}>
            {isRecording
              ? "Recording... Tap stop when done"
              : "Tap to start recording walkthrough"}
          </Text>

          {/* Duration Info */}
          <Text style={styles.maxDurationText}>
            Max duration: 5 minutes
          </Text>

          {/* Record/Stop Button */}
          <View style={styles.buttonRow}>
            {isRecording ? (
              <>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelRecording}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Discard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.stopButton, isLoading && styles.buttonDisabled]}
                  onPress={handleStopRecording}
                  disabled={isLoading}
                >
                  <View style={styles.stopButtonInner} />
                </TouchableOpacity>

                <View style={styles.spacer} />
              </>
            ) : (
              <>
                <View style={styles.spacer} />

                <TouchableOpacity
                  style={[styles.recordButton, isLoading && styles.buttonDisabled]}
                  onPress={handleStartRecording}
                  disabled={isLoading}
                >
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>

                <View style={styles.spacer} />
              </>
            )}
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
  buttonDisabled: {
    opacity: 0.4,
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
  placeholder: {
    width: 40,
  },
  recordingIndicator: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ef4444",
  },
  recordingText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "700",
  },
  durationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
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
  progressBarContainer: {
    position: "absolute",
    bottom: 180,
    left: 16,
    right: 16,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#ef4444",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  instructionText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  maxDurationText: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: {
    flex: 1,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ef4444",
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#ef4444",
  },
  stopButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default VideoCapture;
