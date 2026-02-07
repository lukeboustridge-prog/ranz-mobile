/**
 * PhotoAnnotationFlow Component
 * Complete annotation workflow container for gallery integration
 *
 * Flow states:
 * - viewing: Show photo with option to start annotating
 * - annotating: PhotoAnnotator active for drawing annotations
 * - saving: Saving annotations to storage
 * - saved: Success confirmation before auto-close
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { PhotoAnnotator, type Annotation } from "./PhotoAnnotator";
import {
  saveAnnotations,
  loadAnnotations,
} from "../services/annotation-service";
import type { LocalPhoto } from "../types/database";

// ============================================
// TYPES
// ============================================

type FlowState = "viewing" | "annotating" | "saving" | "saved";

interface PhotoAnnotationFlowProps {
  photo: LocalPhoto;
  visible: boolean;
  onClose: () => void;
  onAnnotationSaved?: (photo: LocalPhoto, annotatedUri: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export function PhotoAnnotationFlow({
  photo,
  visible,
  onClose,
  onAnnotationSaved,
}: PhotoAnnotationFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>("viewing");
  const [existingAnnotations, setExistingAnnotations] = useState<Annotation[]>(
    []
  );
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing annotations when photo changes
  useEffect(() => {
    async function loadExisting() {
      if (!photo?.id) return;

      setIsLoadingAnnotations(true);
      try {
        const data = await loadAnnotations(photo.id);
        if (data) {
          setExistingAnnotations(data.annotations);
        } else {
          setExistingAnnotations([]);
        }
      } catch (err) {
        console.error("[PhotoAnnotationFlow] Failed to load annotations:", err);
        setExistingAnnotations([]);
      } finally {
        setIsLoadingAnnotations(false);
      }
    }

    if (visible) {
      loadExisting();
      setFlowState("viewing");
      setError(null);
    }
  }, [photo?.id, visible]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // Handle start annotating
  const handleStartAnnotating = useCallback(() => {
    setFlowState("annotating");
  }, []);

  // Handle cancel (from viewing state)
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle cancel from annotating (with confirmation if annotations exist)
  const handleCancelAnnotating = useCallback(() => {
    // Go back to viewing state instead of closing completely
    setFlowState("viewing");
  }, []);

  // Handle save from PhotoAnnotator
  const handleSave = useCallback(
    async (annotatedUri: string, annotations: Annotation[]) => {
      setFlowState("saving");
      setError(null);

      try {
        const result = await saveAnnotations(photo.id, annotations, annotatedUri);

        if (result.success && result.annotatedUri) {
          setFlowState("saved");

          // Notify parent
          if (onAnnotationSaved) {
            onAnnotationSaved(photo, result.annotatedUri);
          }

          // Auto-close after 1.5 seconds
          autoCloseTimerRef.current = setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError(result.error || "Failed to save annotations");
          Alert.alert(
            "Save Failed",
            result.error || "Unable to save annotations. Would you like to retry?",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => setFlowState("viewing"),
              },
              {
                text: "Retry",
                onPress: () => handleSave(annotatedUri, annotations),
              },
            ]
          );
        }
      } catch (err) {
        console.error("[PhotoAnnotationFlow] Save error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        Alert.alert("Save Failed", errorMessage, [
          {
            text: "OK",
            onPress: () => setFlowState("viewing"),
          },
        ]);
      }
    },
    [photo, onAnnotationSaved, onClose]
  );

  // Determine button text based on existing annotations
  const hasExisting = existingAnnotations.length > 0;
  const annotateButtonText = hasExisting ? "Edit Annotations" : "Add Annotations";

  // Render viewing state
  const renderViewingState = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Annotation</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.imageContainer}>
        {isLoadingAnnotations ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2d5c8f" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <Image
            source={{ uri: photo.localUri }}
            style={styles.image}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Evidence integrity reminder */}
      <View style={styles.integrityBanner}>
        <Text style={styles.integrityIcon}>i</Text>
        <Text style={styles.integrityText}>
          Original photo preserved. Annotations are saved separately for evidence
          integrity.
        </Text>
      </View>

      {/* Annotation count badge if existing */}
      {hasExisting && (
        <View style={styles.annotationCountBadge}>
          <Text style={styles.annotationCountText}>
            {existingAnnotations.length} annotation
            {existingAnnotations.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.startButton,
            isLoadingAnnotations && styles.startButtonDisabled,
          ]}
          onPress={handleStartAnnotating}
          disabled={isLoadingAnnotations}
        >
          <Text style={styles.startButtonText}>{annotateButtonText}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Render annotating state
  const renderAnnotatingState = () => (
    <PhotoAnnotator
      imageUri={photo.localUri}
      initialAnnotations={existingAnnotations}
      onSave={handleSave}
      onCancel={handleCancelAnnotating}
    />
  );

  // Render saving state
  const renderSavingState = () => (
    <View style={styles.savingContainer}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.savingText}>Saving annotations...</Text>
      <Text style={styles.savingSubtext}>
        Preserving original photo integrity
      </Text>
    </View>
  );

  // Render saved state
  const renderSavedState = () => (
    <View style={styles.savedContainer}>
      <View style={styles.successIcon}>
        <Text style={styles.successIconText}>OK</Text>
      </View>
      <Text style={styles.savedTitle}>Annotations Saved</Text>
      <Text style={styles.savedSubtext}>
        Original photo preserved. Annotated version created.
      </Text>
    </View>
  );

  // Render current state
  const renderContent = () => {
    switch (flowState) {
      case "viewing":
        return renderViewingState();
      case "annotating":
        return renderAnnotatingState();
      case "saving":
        return renderSavingState();
      case "saved":
        return renderSavedState();
      default:
        return renderViewingState();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      {renderContent()}
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111",
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  headerButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  imageContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    marginTop: 12,
  },
  integrityBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  integrityIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2d5c8f",
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 20,
    overflow: "hidden",
  },
  integrityText: {
    flex: 1,
    color: "#a3c4e8",
    fontSize: 12,
  },
  annotationCountBadge: {
    position: "absolute",
    top: 80,
    right: 16,
    backgroundColor: "#2d5c8f",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  annotationCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: "#111",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#333",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  startButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#2d5c8f",
    alignItems: "center",
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  savingContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  savingText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
  },
  savingSubtext: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
  },
  savedContainer: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successIconText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  savedTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
  },
  savedSubtext: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
  },
});

export default PhotoAnnotationFlow;
