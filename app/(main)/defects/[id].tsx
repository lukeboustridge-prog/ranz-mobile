/**
 * Edit Defect Screen
 * Form to edit an existing defect
 */

import { useState, useEffect } from "react";
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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function EditDefectScreen() {
  const { id, reportId } = useLocalSearchParams<{ id: string; reportId: string }>();
  const router = useRouter();
  const {
    getDefects,
    saveDefect,
    deleteDefect,
    getRoofElements,
    getPhotosForDefect,
  } = useLocalDB();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roofElements, setRoofElements] = useState<LocalRoofElement[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [defect, setDefect] = useState<LocalDefect | null>(null);

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
    loadData();
  }, [id, reportId]);

  const loadData = async () => {
    if (!id || !reportId) return;
    setIsLoading(true);
    try {
      // Load defect
      const defects = await getDefects(reportId);
      const foundDefect = defects.find((d) => d.id === id);

      if (foundDefect) {
        setDefect(foundDefect);
        setTitle(foundDefect.title);
        setSeverity(foundDefect.severity as DefectSeverity);
        setClassification(foundDefect.classification as DefectClass);
        setLocation(foundDefect.location);
        setRoofElementId(foundDefect.roofElementId);
        setObservation(foundDefect.observation);
        setAnalysis(foundDefect.analysis || "");
        setOpinion(foundDefect.opinion || "");
        setCodeReference(foundDefect.codeReference || "");
        setCopReference(foundDefect.copReference || "");
        setRecommendation(foundDefect.recommendation || "");
        setPriorityLevel(foundDefect.priorityLevel as PriorityLevel | null);
      }

      // Load roof elements
      const elements = await getRoofElements(reportId);
      setRoofElements(elements);

      // Load photos for this defect
      const defectPhotos = await getPhotosForDefect(id);
      setPhotos(defectPhotos);
    } catch (error) {
      console.error("Failed to load defect:", error);
      Alert.alert("Error", "Failed to load defect");
    } finally {
      setIsLoading(false);
    }
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
    if (!validateForm() || !defect || !reportId) return;

    setIsSaving(true);

    try {
      const now = new Date().toISOString();

      const updatedDefect: LocalDefect = {
        ...defect,
        title: title.trim(),
        description: observation.trim(),
        location: location.trim(),
        classification,
        severity,
        roofElementId,
        observation: observation.trim(),
        analysis: analysis.trim() || null,
        opinion: opinion.trim() || null,
        codeReference: codeReference.trim() || null,
        copReference: copReference.trim() || null,
        recommendation: recommendation.trim() || null,
        priorityLevel,
        syncStatus: "pending",
        updatedAt: now,
      };

      await saveDefect(updatedDefect);

      // Add to sync queue
      if (Platform.OS !== "web") {
        const sqlite = await import("../../../src/lib/sqlite");
        await sqlite.addToSyncQueue("defect", id!, "update", updatedDefect as unknown as Record<string, unknown>);
        await sqlite.markReportDirty(reportId);
      }

      router.back();
    } catch (error) {
      console.error("Failed to save defect:", error);
      Alert.alert("Error", "Failed to save defect. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Defect",
      "Are you sure you want to delete this defect? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDefect(id!);
              if (Platform.OS !== "web" && reportId) {
                const sqlite = await import("../../../src/lib/sqlite");
                await sqlite.markReportDirty(reportId);
              }
              router.back();
            } catch (error) {
              console.error("Failed to delete defect:", error);
              Alert.alert("Error", "Failed to delete defect");
            }
          },
        },
      ]
    );
  };

  const handleAddPhoto = () => {
    Alert.alert(
      "Add Photo",
      "To add photos, go back to the report and use the Photo Capture feature.",
      [{ text: "OK" }]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading defect...</Text>
      </View>
    );
  }

  if (!defect) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Defect not found</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Edit Defect #{defect.defectNumber}</Text>
            <TouchableOpacity onPress={handleDelete}>
              <Text style={styles.deleteButton}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Photos Section */}
        <FormSection title="Evidence Photos">
          <PhotoGrid
            photos={photos}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={(photoId) =>
              setPhotos(photos.filter((p) => p.id !== photoId))
            }
          />
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
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    fontSize: 16,
    color: "#64748b",
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
  errorButton: {
    backgroundColor: "#2d5c8f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    marginBottom: 24,
    paddingTop: 40,
  },
  backButton: {
    color: "#2d5c8f",
    fontSize: 16,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  deleteButton: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
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
    backgroundColor: "#2d5c8f",
    borderColor: "#2d5c8f",
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
    backgroundColor: "#2d5c8f",
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
