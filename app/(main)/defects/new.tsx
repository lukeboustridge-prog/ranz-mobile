/**
 * New Defect Screen
 * Form to create a new defect
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Image,
  ActionSheetIOS,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useLocalDB } from "../../../src/hooks/useLocalDB";
import { ChipSelector } from "../../../src/components/ChipSelector";
import { FormSection } from "../../../src/components/FormSection";
import { PhotoGrid } from "../../../src/components/PhotoGrid";
import type { LocalDefect, LocalRoofElement, LocalPhoto } from "../../../src/types/database";
import { DefectClass, DefectSeverity, PriorityLevel } from "../../../src/types/shared";

const SEVERITY_OPTIONS = [
  { value: DefectSeverity.CRITICAL, label: "Critical", color: "#ef4444" },
  { value: DefectSeverity.HIGH, label: "High", color: "#f97316" },
  { value: DefectSeverity.MEDIUM, label: "Medium", color: "#eab308" },
  { value: DefectSeverity.LOW, label: "Low", color: "#22c55e" },
];

const CLASSIFICATION_OPTIONS = [
  { value: DefectClass.MAJOR_DEFECT, label: "Major Defect" },
  { value: DefectClass.MINOR_DEFECT, label: "Minor Defect" },
  { value: DefectClass.SAFETY_HAZARD, label: "Safety Hazard" },
  { value: DefectClass.MAINTENANCE_ITEM, label: "Maintenance" },
];

const PRIORITY_OPTIONS = [
  { value: PriorityLevel.IMMEDIATE, label: "Immediate" },
  { value: PriorityLevel.SHORT_TERM, label: "Short Term" },
  { value: PriorityLevel.MEDIUM_TERM, label: "Medium Term" },
  { value: PriorityLevel.LONG_TERM, label: "Long Term" },
];

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

const PICKER_ITEM_SIZE = (Dimensions.get("window").width - 48 - 16) / 3; // 3 columns, 16px padding, 8px gaps

export default function NewDefectScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const {
    saveDefect,
    getNextDefectNumber,
    getRoofElements,
    getPhotosForDefect,
    getPhotos,
    updatePhotoClassification,
  } = useLocalDB();

  // Pre-generate defect ID so camera can save photos with it
  const [defectId] = useState(generateLocalId);

  const [isLoading, setIsLoading] = useState(false);
  const [roofElements, setRoofElements] = useState<LocalRoofElement[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [unlinkedPhotos, setUnlinkedPhotos] = useState<LocalPhoto[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState(DefectSeverity.MEDIUM);
  const [classification, setClassification] = useState(DefectClass.MINOR_DEFECT);
  const [location, setLocation] = useState("");
  const [roofElementId, setRoofElementId] = useState<string | null>(null);
  const [observation, setObservation] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [opinion, setOpinion] = useState("");
  const [codeReference, setCodeReference] = useState("");
  const [copReference, setCopReference] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel | null>(null);

  useEffect(() => {
    loadRoofElements();
  }, [reportId]);

  // Reload photos every time the screen gains focus (e.g. returning from camera)
  useFocusEffect(
    useCallback(() => {
      loadDefectPhotos();
    }, [defectId])
  );

  const loadRoofElements = async () => {
    if (!reportId) return;
    const elements = await getRoofElements(reportId);
    setRoofElements(elements);
  };

  const loadDefectPhotos = async () => {
    const defectPhotos = await getPhotosForDefect(defectId);
    setPhotos(defectPhotos);
  };

  const validateForm = (): boolean => {
    if (!title.trim() || title.length < 3) {
      Alert.alert("Error", "Title must be at least 3 characters");
      return false;
    }
    if (!location.trim() || location.length < 3) {
      Alert.alert("Error", "Location must be at least 3 characters");
      return false;
    }
    if (!observation.trim() || observation.length < 10) {
      Alert.alert("Error", "Observation must be at least 10 characters");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !reportId) return;

    setIsLoading(true);

    try {
      const defectNumber = await getNextDefectNumber(reportId);
      const now = new Date().toISOString();

      const newDefect: LocalDefect = {
        id: defectId,
        reportId,
        roofElementId,
        defectNumber,
        title: title.trim(),
        description: observation.trim(), // description = observation for display
        location: location.trim(),
        classification,
        severity,
        observation: observation.trim(),
        analysis: analysis.trim() || null,
        opinion: opinion.trim() || null,
        codeReference: codeReference.trim() || null,
        copReference: copReference.trim() || null,
        recommendation: recommendation.trim() || null,
        priorityLevel,
        syncStatus: "draft",
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      };

      await saveDefect(newDefect);

      // Mark report as needing sync
      if (Platform.OS !== "web") {
        const sqlite = await import("../../../src/lib/sqlite");
        await sqlite.markReportDirty(reportId);
      }

      router.back();
    } catch (error) {
      console.error("Failed to save defect:", error);
      Alert.alert("Error", "Failed to save defect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPhoto = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Link Existing Photo"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) navigateToCamera();
          if (buttonIndex === 2) openPhotoPicker();
        }
      );
    } else {
      // Android / web fallback using Alert
      Alert.alert("Add Photo", "Choose an option", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: navigateToCamera },
        { text: "Link Existing Photo", onPress: openPhotoPicker },
      ]);
    }
  };

  const navigateToCamera = () => {
    if (!reportId) return;
    router.push(`/(main)/photo-capture?reportId=${reportId}&defectId=${defectId}`);
  };

  const openPhotoPicker = async () => {
    if (!reportId) return;
    const allPhotos = await getPhotos(reportId);
    const available = allPhotos.filter((p) => !p.defectId);
    setUnlinkedPhotos(available);
    setShowPhotoPicker(true);
  };

  const handleLinkPhoto = async (photo: LocalPhoto) => {
    try {
      await updatePhotoClassification(photo.id, { defectId });
      // Refresh both lists
      await loadDefectPhotos();
      setUnlinkedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (error) {
      console.error("Failed to link photo:", error);
      Alert.alert("Error", "Failed to link photo.");
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    try {
      await updatePhotoClassification(photoId, { defectId: null });
      await loadDefectPhotos();
    } catch (error) {
      console.error("Failed to unlink photo:", error);
      Alert.alert("Error", "Failed to unlink photo.");
    }
  };

  const renderPickerItem = ({ item }: { item: LocalPhoto }) => (
    <TouchableOpacity
      style={pickerStyles.photoItem}
      onPress={() => handleLinkPhoto(item)}
    >
      <Image
        source={{ uri: item.thumbnailUri || item.localUri }}
        style={pickerStyles.photoImage}
      />
      {item.caption ? (
        <Text style={pickerStyles.photoCaption} numberOfLines={1}>
          {item.caption}
        </Text>
      ) : (
        <Text style={pickerStyles.photoType} numberOfLines={1}>
          {item.photoType.replace(/_/g, " ")}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Defect</Text>
        </View>

        {/* Photos Section */}
        <FormSection title="Evidence Photos">
          <PhotoGrid
            photos={photos}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
          />
          <Text style={styles.helperText}>
            Photos help document and evidence the defect
          </Text>
        </FormSection>

        {/* Defect Details */}
        <FormSection title="Defect Details">
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Rust penetration at ridge flashing"
            />
          </View>

          <ChipSelector
            label="Severity"
            options={SEVERITY_OPTIONS}
            value={severity}
            onChange={(v) => setSeverity(v as DefectSeverity)}
            required
          />

          <ChipSelector
            label="Classification"
            options={CLASSIFICATION_OPTIONS}
            value={classification}
            onChange={(v) => setClassification(v as DefectClass)}
            required
          />

          <View style={styles.field}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., North elevation, main ridge"
            />
          </View>

          {roofElements.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Link to Roof Element</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.elementRow}>
                  <TouchableOpacity
                    style={[
                      styles.elementChip,
                      !roofElementId && styles.elementChipActive,
                    ]}
                    onPress={() => setRoofElementId(null)}
                  >
                    <Text
                      style={[
                        styles.elementChipText,
                        !roofElementId && styles.elementChipTextActive,
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {roofElements.map((el) => (
                    <TouchableOpacity
                      key={el.id}
                      style={[
                        styles.elementChip,
                        roofElementId === el.id && styles.elementChipActive,
                      ]}
                      onPress={() => setRoofElementId(el.id)}
                    >
                      <Text
                        style={[
                          styles.elementChipText,
                          roofElementId === el.id && styles.elementChipTextActive,
                        ]}
                      >
                        {el.elementType.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </FormSection>

        {/* Three-Part Structure */}
        <FormSection title="Assessment (ISO Compliant)">
          <View style={styles.field}>
            <Text style={styles.label}>Factual Observation *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observation}
              onChangeText={setObservation}
              placeholder="Describe exactly what you observed..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>
              State only facts - what you saw, measured, or documented
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Technical Analysis</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={analysis}
              onChangeText={setAnalysis}
              placeholder="Technical interpretation of the observation..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Professional Opinion</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={opinion}
              onChangeText={setOpinion}
              placeholder="In my professional opinion..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </FormSection>

        {/* Code References */}
        <FormSection title="Code References">
          <View style={styles.field}>
            <Text style={styles.label}>Building Code Reference</Text>
            <TextInput
              style={styles.input}
              value={codeReference}
              onChangeText={setCodeReference}
              placeholder="e.g., E2/AS1 Section 9.1"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>COP Reference</Text>
            <TextInput
              style={styles.input}
              value={copReference}
              onChangeText={setCopReference}
              placeholder="e.g., COP v25.12 Section 7.1"
            />
          </View>
        </FormSection>

        {/* Recommendation */}
        <FormSection title="Recommendation">
          <View style={styles.field}>
            <Text style={styles.label}>Remediation Recommendation</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={recommendation}
              onChangeText={setRecommendation}
              placeholder="Recommended remediation actions..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <ChipSelector
            label="Priority Level"
            options={PRIORITY_OPTIONS}
            value={priorityLevel || ""}
            onChange={(v) => setPriorityLevel(v as PriorityLevel)}
          />
        </FormSection>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Saving..." : "Save Defect"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Photo Picker Modal */}
      <Modal
        visible={showPhotoPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPhotoPicker(false)}
      >
        <View style={pickerStyles.container}>
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Link Existing Photo</Text>
            <TouchableOpacity onPress={() => setShowPhotoPicker(false)}>
              <Text style={pickerStyles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={pickerStyles.subtitle}>
            Tap a photo to link it to this defect
          </Text>
          <FlatList
            data={unlinkedPhotos}
            renderItem={renderPickerItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={pickerStyles.grid}
            ListEmptyComponent={
              <View style={pickerStyles.emptyState}>
                <Text style={pickerStyles.emptyTitle}>No unlinked photos</Text>
                <Text style={pickerStyles.emptySubtitle}>
                  All report photos are already linked to defects.
                  Use "Take Photo" to capture a new one.
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    paddingTop: 40,
  },
  backButton: {
    color: "#3c4b5d",
    fontSize: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e293b",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  elementRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  elementChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  elementChipActive: {
    backgroundColor: "#3c4b5d",
    borderColor: "#3c4b5d",
  },
  elementChipText: {
    fontSize: 13,
    color: "#374151",
  },
  elementChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#3c4b5d",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  closeButton: {
    fontSize: 16,
    color: "#3c4b5d",
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  grid: {
    padding: 16,
    paddingBottom: 40,
  },
  photoItem: {
    width: PICKER_ITEM_SIZE,
    marginRight: 8,
    marginBottom: 12,
  },
  photoImage: {
    width: PICKER_ITEM_SIZE,
    height: PICKER_ITEM_SIZE,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  photoCaption: {
    fontSize: 11,
    color: "#374151",
    marginTop: 4,
  },
  photoType: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    textTransform: "capitalize",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
});
