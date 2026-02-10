/**
 * PreSubmitChecklist Component (Mobile)
 * Shows validation status in real-time as inspector works on a report.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";

// Types
interface ValidationDetails {
  propertyDetails: { complete: boolean; missing: string[] };
  inspectionDetails: { complete: boolean; missing: string[] };
  roofElements: { complete: boolean; count: number; minimum: number };
  defects: { documented: boolean; count: number };
  photos: {
    sufficient: boolean;
    count: number;
    minimum: number;
    withExif: number;
    withGps: number;
  };
  compliance: { complete: boolean; coverage: number; required: number };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completionPercentage: number;
  missingRequiredItems: string[];
  validationDetails: ValidationDetails;
}

interface PreSubmitChecklistProps {
  reportId: string;
  inspectionType?: string;
  compact?: boolean;
  onValidationChange?: (validation: ValidationResult) => void;
}

// Section configuration
const SECTIONS = [
  {
    key: "propertyDetails",
    label: "Property Details",
    icon: "P",
    screen: "ReportEdit",
    description: "Address, type, location",
  },
  {
    key: "inspectionDetails",
    label: "Inspection Details",
    icon: "I",
    screen: "ReportEdit",
    description: "Date, weather, access",
  },
  {
    key: "roofElements",
    label: "Roof Elements",
    icon: "E",
    screen: "RoofElements",
    description: "Document components",
  },
  {
    key: "photos",
    label: "Photos",
    icon: "C",
    screen: "Photos",
    description: "Photo evidence",
  },
  {
    key: "defects",
    label: "Defects",
    icon: "D",
    screen: "Defects",
    description: "Document defects",
  },
  {
    key: "compliance",
    label: "Compliance",
    icon: "S",
    screen: "Compliance",
    description: "Code checklists",
  },
] as const;

// Court report types require stricter evidence
const COURT_REPORT_TYPES = ["DISPUTE_RESOLUTION", "WARRANTY_CLAIM"];

export function PreSubmitChecklist({
  reportId,
  inspectionType,
  compact = false,
  onValidationChange,
}: PreSubmitChecklistProps) {
  const navigation = useNavigation();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  const isCourtReport = inspectionType
    ? COURT_REPORT_TYPES.includes(inspectionType)
    : false;

  // Fetch validation status
  const fetchValidation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get(`/reports/${reportId}/submit`);
      setValidation(response.validation);
      if (onValidationChange) {
        onValidationChange(response.validation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checklist");
    } finally {
      setIsLoading(false);
    }
  }, [reportId, onValidationChange]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  // Get section status
  const getSectionStatus = (key: string) => {
    if (!validation) return { complete: false, details: "" };

    const details = validation.validationDetails;

    switch (key) {
      case "propertyDetails":
        return {
          complete: details.propertyDetails.complete,
          details: details.propertyDetails.complete
            ? "Complete"
            : `Missing: ${details.propertyDetails.missing.slice(0, 2).join(", ")}${
                details.propertyDetails.missing.length > 2 ? "..." : ""
              }`,
        };
      case "inspectionDetails":
        return {
          complete: details.inspectionDetails.complete,
          details: details.inspectionDetails.complete
            ? "Complete"
            : `Missing: ${details.inspectionDetails.missing.slice(0, 2).join(", ")}${
                details.inspectionDetails.missing.length > 2 ? "..." : ""
              }`,
        };
      case "roofElements":
        return {
          complete: details.roofElements.complete,
          details: `${details.roofElements.count} / ${details.roofElements.minimum} minimum`,
        };
      case "photos": {
        const photoStatus = details.photos;
        const exifWarning =
          isCourtReport && photoStatus.withExif < photoStatus.count;
        const gpsWarning =
          isCourtReport && photoStatus.withGps < photoStatus.count;
        return {
          complete: photoStatus.sufficient && !exifWarning && !gpsWarning,
          details: `${photoStatus.count} / ${photoStatus.minimum} minimum`,
          exifCount: photoStatus.withExif,
          gpsCount: photoStatus.withGps,
          exifWarning,
          gpsWarning,
        };
      }
      case "defects":
        return {
          complete: true,
          details: `${details.defects.count} documented`,
        };
      case "compliance":
        return {
          complete: details.compliance.complete,
          details: `${details.compliance.coverage}% coverage`,
        };
      default:
        return { complete: false, details: "" };
    }
  };

  // Navigate to section
  const navigateToSection = (screen: string) => {
    // @ts-expect-error - navigation typing
    navigation.navigate(screen, { reportId });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3c4b5d" />
          <Text style={styles.loadingText}>Checking readiness...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchValidation}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!validation) return null;

  // Compact collapsed mode
  if (compact && !expanded) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={() => setExpanded(true)}
      >
        <View
          style={[
            styles.percentBadge,
            validation.isValid ? styles.percentBadgeReady : styles.percentBadgePending,
          ]}
        >
          <Text
            style={[
              styles.percentText,
              validation.isValid ? styles.percentTextReady : styles.percentTextPending,
            ]}
          >
            {validation.completionPercentage}%
          </Text>
        </View>
        <Text style={styles.compactLabel}>Submission Checklist</Text>
        <Text style={styles.chevron}>&gt;</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Pre-Submit Checklist</Text>
          <View
            style={[
              styles.statusBadge,
              validation.isValid ? styles.statusReady : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                validation.isValid
                  ? styles.statusTextReady
                  : styles.statusTextPending,
              ]}
            >
              {validation.isValid
                ? "Ready"
                : `${validation.missingRequiredItems.length} items`}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={fetchValidation} style={styles.refreshButton}>
            <Text style={styles.refreshIcon}>R</Text>
          </TouchableOpacity>
          {compact && (
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              style={styles.collapseButton}
            >
              <Text style={styles.collapseIcon}>-</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Completion</Text>
          <Text style={styles.progressValue}>
            {validation.completionPercentage}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${validation.completionPercentage}%`,
                backgroundColor: validation.isValid ? "#16a34a" : "#ea580c",
              },
            ]}
          />
        </View>
      </View>

      {/* Court Report Notice */}
      {isCourtReport && (
        <View style={styles.courtNotice}>
          <Text style={styles.courtNoticeText}>
            Court Report: Strict EXIF and GPS requirements
          </Text>
        </View>
      )}

      {/* Sections */}
      <View style={styles.sections}>
        {SECTIONS.map((section) => {
          const status = getSectionStatus(section.key);
          const isPhotoSection = section.key === "photos";
          const photoStatus = isPhotoSection
            ? (status as {
                complete: boolean;
                details: string;
                exifCount?: number;
                gpsCount?: number;
                exifWarning?: boolean;
                gpsWarning?: boolean;
              })
            : status;

          return (
            <TouchableOpacity
              key={section.key}
              style={[
                styles.sectionItem,
                status.complete ? styles.sectionComplete : styles.sectionIncomplete,
              ]}
              onPress={() => navigateToSection(section.screen)}
            >
              {/* Status Indicator */}
              <View
                style={[
                  styles.statusIndicator,
                  status.complete
                    ? styles.indicatorComplete
                    : styles.indicatorIncomplete,
                ]}
              >
                <Text
                  style={[
                    styles.indicatorIcon,
                    status.complete
                      ? styles.indicatorIconComplete
                      : styles.indicatorIconIncomplete,
                  ]}
                >
                  {status.complete ? "V" : "X"}
                </Text>
              </View>

              {/* Section Info */}
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <Text style={styles.sectionDetails}>{status.details}</Text>

                {/* Photo EXIF/GPS for court reports */}
                {isPhotoSection && isCourtReport && (
                  <View style={styles.photoMeta}>
                    <Text
                      style={[
                        styles.photoMetaText,
                        photoStatus.exifWarning && styles.photoMetaWarning,
                      ]}
                    >
                      EXIF: {photoStatus.exifCount || 0}/
                      {validation.validationDetails.photos.count}
                    </Text>
                    <Text
                      style={[
                        styles.photoMetaText,
                        photoStatus.gpsWarning && styles.photoMetaWarning,
                      ]}
                    >
                      GPS: {photoStatus.gpsCount || 0}/
                      {validation.validationDetails.photos.count}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionChevron}>&gt;</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <View style={styles.errorsContainer}>
          <Text style={styles.errorsTitle}>
            Blocking Issues ({validation.errors.length})
          </Text>
          {validation.errors.slice(0, 3).map((error, index) => (
            <Text key={index} style={styles.errorItem}>
              - {error}
            </Text>
          ))}
          {validation.errors.length > 3 && (
            <Text style={styles.errorItem}>
              + {validation.errors.length - 3} more
            </Text>
          )}
        </View>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          <Text style={styles.warningsTitle}>
            Warnings ({validation.warnings.length})
          </Text>
          {validation.warnings.slice(0, 2).map((warning, index) => (
            <Text key={index} style={styles.warningItem}>
              - {warning}
            </Text>
          ))}
          {validation.warnings.length > 2 && (
            <Text style={styles.warningItem}>
              + {validation.warnings.length - 2} more
            </Text>
          )}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          validation.isValid ? styles.submitReady : styles.submitDisabled,
        ]}
        onPress={() => navigateToSection("Submit")}
        disabled={!validation.isValid}
      >
        <Text
          style={[
            styles.submitButtonText,
            validation.isValid
              ? styles.submitTextReady
              : styles.submitTextDisabled,
          ]}
        >
          {validation.isValid
            ? "Review & Submit Report"
            : `Complete ${validation.missingRequiredItems.length} Item${
                validation.missingRequiredItems.length !== 1 ? "s" : ""
              }`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  errorContainer: {
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  percentBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  percentBadgeReady: {
    backgroundColor: "#dcfce7",
  },
  percentBadgePending: {
    backgroundColor: "#fef3c7",
  },
  percentText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  percentTextReady: {
    color: "#16a34a",
  },
  percentTextPending: {
    color: "#d97706",
  },
  compactLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  chevron: {
    fontSize: 16,
    color: "#9ca3af",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusReady: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  statusPending: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "500",
  },
  statusTextReady: {
    color: "#16a34a",
  },
  statusTextPending: {
    color: "#ea580c",
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshIcon: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#6b7280",
  },
  collapseButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  collapseIcon: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6b7280",
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  progressValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  courtNotice: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  courtNoticeText: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "500",
  },
  sections: {
    gap: 8,
  },
  sectionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionComplete: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  sectionIncomplete: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  indicatorComplete: {
    backgroundColor: "#dcfce7",
  },
  indicatorIncomplete: {
    backgroundColor: "#fef3c7",
  },
  indicatorIcon: {
    fontSize: 12,
    fontWeight: "bold",
  },
  indicatorIconComplete: {
    color: "#16a34a",
  },
  indicatorIconIncomplete: {
    color: "#ea580c",
  },
  sectionInfo: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  sectionDetails: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  sectionChevron: {
    fontSize: 14,
    color: "#9ca3af",
  },
  photoMeta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  photoMetaText: {
    fontSize: 10,
    color: "#6b7280",
  },
  photoMetaWarning: {
    color: "#ea580c",
  },
  errorsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
  },
  errorsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 6,
  },
  errorItem: {
    fontSize: 11,
    color: "#dc2626",
    marginBottom: 2,
  },
  warningsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
  },
  warningsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#d97706",
    marginBottom: 6,
  },
  warningItem: {
    fontSize: 11,
    color: "#d97706",
    marginBottom: 2,
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitReady: {
    backgroundColor: "#3c4b5d",
  },
  submitDisabled: {
    backgroundColor: "#e5e7eb",
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  submitTextReady: {
    color: "#fff",
  },
  submitTextDisabled: {
    color: "#6b7280",
  },
});

export default PreSubmitChecklist;
