/**
 * New Report Screen
 * Form to create a new inspection report
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
import { useRouter } from "expo-router";
import { useLocalDB } from "../../src/hooks/useLocalDB";
import type { LocalReport, LocalTemplate } from "../../src/types/database";
import { InspectionType, PropertyType, ReportStatus } from "../../src/types/shared";

const PROPERTY_TYPES = [
  { value: PropertyType.RESIDENTIAL_1, label: "Residential - 1 storey" },
  { value: PropertyType.RESIDENTIAL_2, label: "Residential - 2 storey" },
  { value: PropertyType.RESIDENTIAL_3, label: "Residential - 3+ storey" },
  { value: PropertyType.COMMERCIAL_LOW, label: "Commercial - Low rise" },
  { value: PropertyType.COMMERCIAL_HIGH, label: "Commercial - High rise" },
  { value: PropertyType.INDUSTRIAL, label: "Industrial" },
];

const INSPECTION_TYPES = [
  { value: InspectionType.FULL_INSPECTION, label: "Full Inspection" },
  { value: InspectionType.VISUAL_ONLY, label: "Visual Only" },
  { value: InspectionType.NON_INVASIVE, label: "Non-Invasive" },
  { value: InspectionType.INVASIVE, label: "Invasive" },
  { value: InspectionType.PRE_PURCHASE, label: "Pre-Purchase" },
  { value: InspectionType.DISPUTE_RESOLUTION, label: "Dispute Resolution" },
  { value: InspectionType.MAINTENANCE_REVIEW, label: "Maintenance Review" },
];

export default function NewReportScreen() {
  const router = useRouter();
  const { saveReport, getTemplates } = useLocalDB();

  const [templates, setTemplates] = useState<LocalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyCity, setPropertyCity] = useState("");
  const [propertyRegion, setPropertyRegion] = useState("");
  const [propertyPostcode, setPropertyPostcode] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>(PropertyType.RESIDENTIAL_1);
  const [buildingAge, setBuildingAge] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [inspectionType, setInspectionType] = useState<InspectionType>(InspectionType.FULL_INSPECTION);
  const [weatherConditions, setWeatherConditions] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const loadedTemplates = await getTemplates();
    setTemplates(loadedTemplates);
  };

  const validateForm = (): boolean => {
    if (!propertyAddress.trim()) {
      Alert.alert("Error", "Property address is required");
      return false;
    }
    if (!propertyCity.trim()) {
      Alert.alert("Error", "City is required");
      return false;
    }
    if (!clientName.trim()) {
      Alert.alert("Error", "Client name is required");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const now = new Date().toISOString();
      const id = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const newReport: LocalReport = {
        id,
        reportNumber: null,
        status: ReportStatus.DRAFT,
        propertyAddress: propertyAddress.trim(),
        propertyCity: propertyCity.trim(),
        propertyRegion: propertyRegion.trim() || "Unknown",
        propertyPostcode: propertyPostcode.trim() || "0000",
        propertyType,
        buildingAge: buildingAge ? parseInt(buildingAge, 10) : null,
        gpsLat: null,
        gpsLng: null,
        inspectionDate: now,
        inspectionType,
        weatherConditions: weatherConditions.trim() || null,
        accessMethod: null,
        limitations: null,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        scopeOfWorksJson: null,
        methodologyJson: null,
        findingsJson: null,
        conclusionsJson: null,
        recommendationsJson: null,
        declarationSigned: false,
        signedAt: null,
        inspectorId: null, // Will be set from auth context
        submittedAt: null,
        approvedAt: null,
        syncStatus: "draft",
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
        lastSyncError: null,
      };

      await saveReport(newReport);

      // Add to sync queue (only on native)
      if (Platform.OS !== "web") {
        const sqlite = await import("../../src/lib/sqlite");
        await sqlite.addToSyncQueue("report", id, "create", newReport as unknown as Record<string, unknown>);
      }

      // Navigate to the report detail
      router.replace(`/(main)/report-detail/${id}`);
    } catch (error) {
      console.error("Failed to create report:", error);
      Alert.alert("Error", "Failed to create report. Please try again.");
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
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Inspection</Text>
        </View>

        {/* Property Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              value={propertyAddress}
              onChangeText={setPropertyAddress}
              placeholder="123 Main Street"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                value={propertyCity}
                onChangeText={setPropertyCity}
                placeholder="Auckland"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Region</Text>
              <TextInput
                style={styles.input}
                value={propertyRegion}
                onChangeText={setPropertyRegion}
                placeholder="Auckland"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Postcode</Text>
              <TextInput
                style={styles.input}
                value={propertyPostcode}
                onChangeText={setPropertyPostcode}
                placeholder="1010"
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Building Age</Text>
              <TextInput
                style={styles.input}
                value={buildingAge}
                onChangeText={setBuildingAge}
                placeholder="Years"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Property Type</Text>
            <View style={styles.pickerContainer}>
              {PROPERTY_TYPES.map((pt) => (
                <TouchableOpacity
                  key={pt.value}
                  style={[
                    styles.pickerOption,
                    propertyType === pt.value && styles.pickerOptionActive,
                  ]}
                  onPress={() => setPropertyType(pt.value)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      propertyType === pt.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Client Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Client Name *</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="John Smith"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="021 123 4567"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Inspection Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspection Details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Inspection Type</Text>
            <View style={styles.pickerContainer}>
              {INSPECTION_TYPES.map((it) => (
                <TouchableOpacity
                  key={it.value}
                  style={[
                    styles.pickerOption,
                    inspectionType === it.value && styles.pickerOptionActive,
                  ]}
                  onPress={() => setInspectionType(it.value)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      inspectionType === it.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {it.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Weather Conditions</Text>
            <TextInput
              style={styles.input}
              value={weatherConditions}
              onChangeText={setWeatherConditions}
              placeholder="Clear, 18°C, light wind"
            />
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? "Creating..." : "Create Report"}
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
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
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
  row: {
    flexDirection: "row",
    gap: 12,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickerOptionActive: {
    backgroundColor: "#2d5c8f",
    borderColor: "#2d5c8f",
  },
  pickerOptionText: {
    fontSize: 13,
    color: "#374151",
  },
  pickerOptionTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  createButton: {
    backgroundColor: "#2d5c8f",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  createButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
