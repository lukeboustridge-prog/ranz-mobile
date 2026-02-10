/**
 * New Element Screen
 * Form to create a new roof element
 */

import { useState } from "react";
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
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLocalDB } from "../../../src/hooks/useLocalDB";
import { ChipSelector } from "../../../src/components/ChipSelector";
import { FormSection } from "../../../src/components/FormSection";
import type { LocalRoofElement } from "../../../src/types/database";
import { ElementType, ConditionRating } from "../../../src/types/shared";

const ELEMENT_TYPE_OPTIONS = [
  { value: ElementType.ROOF_CLADDING, label: "Roof Cladding" },
  { value: ElementType.RIDGE, label: "Ridge" },
  { value: ElementType.VALLEY, label: "Valley" },
  { value: ElementType.HIP, label: "Hip" },
  { value: ElementType.BARGE, label: "Barge" },
  { value: ElementType.FASCIA, label: "Fascia" },
  { value: ElementType.GUTTER, label: "Gutter" },
  { value: ElementType.DOWNPIPE, label: "Downpipe" },
  { value: ElementType.FLASHING_WALL, label: "Wall Flashing" },
  { value: ElementType.FLASHING_PENETRATION, label: "Penetration Flashing" },
  { value: ElementType.SKYLIGHT, label: "Skylight" },
  { value: ElementType.VENT, label: "Vent" },
  { value: ElementType.OTHER, label: "Other" },
];

const CONDITION_OPTIONS = [
  { value: ConditionRating.GOOD, label: "Good", color: "#22c55e" },
  { value: ConditionRating.FAIR, label: "Fair", color: "#eab308" },
  { value: ConditionRating.POOR, label: "Poor", color: "#f97316" },
  { value: ConditionRating.CRITICAL, label: "Critical", color: "#ef4444" },
  { value: ConditionRating.NOT_INSPECTED, label: "Not Inspected", color: "#6b7280" },
];

export default function NewElementScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { saveRoofElement } = useLocalDB();

  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [elementType, setElementType] = useState(ElementType.ROOF_CLADDING);
  const [location, setLocation] = useState("");
  const [material, setMaterial] = useState("");
  const [claddingType, setCladdingType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [pitch, setPitch] = useState("");
  const [area, setArea] = useState("");
  const [conditionRating, setConditionRating] = useState(ConditionRating.NOT_INSPECTED);
  const [conditionNotes, setConditionNotes] = useState("");

  const validateForm = (): boolean => {
    if (!location.trim() || location.length < 3) {
      Alert.alert("Error", "Location must be at least 3 characters");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !reportId) return;

    setIsLoading(true);

    try {
      const now = new Date().toISOString();
      const id = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const newElement: LocalRoofElement = {
        id,
        reportId,
        elementType,
        location: location.trim(),
        material: material.trim() || null,
        claddingType: claddingType.trim() || null,
        manufacturer: manufacturer.trim() || null,
        pitch: pitch ? parseFloat(pitch) : null,
        area: area ? parseFloat(area) : null,
        conditionRating,
        conditionNotes: conditionNotes.trim() || null,
        syncStatus: "draft",
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      };

      await saveRoofElement(newElement);

      // Mark report as needing sync
      if (Platform.OS !== "web") {
        const sqlite = await import("../../../src/lib/sqlite");
        await sqlite.markReportDirty(reportId);
      }

      router.back();
    } catch (error) {
      console.error("Failed to save element:", error);
      Alert.alert("Error", "Failed to save element. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <Text style={styles.title}>New Roof Element</Text>
        </View>

        {/* Element Type */}
        <FormSection title="Element Type">
          <View style={styles.typeGrid}>
            {ELEMENT_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.typeOption,
                  elementType === option.value && styles.typeOptionActive,
                ]}
                onPress={() => setElementType(option.value)}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    elementType === option.value && styles.typeOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FormSection>

        {/* Location */}
        <FormSection title="Location">
          <View style={styles.field}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Main roof - north elevation"
            />
          </View>
        </FormSection>

        {/* Material Details */}
        <FormSection title="Material Details">
          <View style={styles.field}>
            <Text style={styles.label}>Material</Text>
            <TextInput
              style={styles.input}
              value={material}
              onChangeText={setMaterial}
              placeholder="e.g., Colorsteel, Aluminium, Concrete tile"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cladding Type</Text>
            <TextInput
              style={styles.input}
              value={claddingType}
              onChangeText={setCladdingType}
              placeholder="e.g., Corrugated, Standing seam, Tray"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Manufacturer</Text>
            <TextInput
              style={styles.input}
              value={manufacturer}
              onChangeText={setManufacturer}
              placeholder="e.g., Steel & Tube, Metalcraft"
            />
          </View>
        </FormSection>

        {/* Measurements */}
        <FormSection title="Measurements">
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Pitch (degrees)</Text>
              <TextInput
                style={styles.input}
                value={pitch}
                onChangeText={setPitch}
                placeholder="e.g., 15"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Area (m²)</Text>
              <TextInput
                style={styles.input}
                value={area}
                onChangeText={setArea}
                placeholder="e.g., 120"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </FormSection>

        {/* Condition Assessment */}
        <FormSection title="Condition Assessment">
          <ChipSelector
            label="Condition Rating"
            options={CONDITION_OPTIONS}
            value={conditionRating}
            onChange={(v) => setConditionRating(v as ConditionRating)}
            required
          />

          <View style={styles.field}>
            <Text style={styles.label}>Condition Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={conditionNotes}
              onChangeText={setConditionNotes}
              placeholder="Notes about the condition..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </FormSection>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Saving..." : "Save Element"}
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
  header: {
    marginBottom: 24,
    paddingTop: 40,
  },
  backButton: {
    color: "#2d5c8f",
    fontSize: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e293b",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  typeOptionActive: {
    backgroundColor: "#2d5c8f",
    borderColor: "#2d5c8f",
  },
  typeOptionText: {
    fontSize: 13,
    color: "#374151",
  },
  typeOptionTextActive: {
    color: "#ffffff",
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
  row: {
    flexDirection: "row",
    gap: 12,
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
