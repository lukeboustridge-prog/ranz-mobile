/**
 * Review Report Detail Screen
 * Detailed view for reviewing a specific report with action buttons
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { StatusBadge, SeverityBadge, ConditionBadge } from "../../../src/components/badges";
import { ReviewActionDialog, ReviewActionType } from "../../../src/components/ReviewActionDialog";
import { reviewService } from "../../../src/services/review-service";
import { getReportWithRelations } from "../../../src/lib/sqlite";
import type { LocalReport, LocalDefect, LocalRoofElement, LocalPhoto } from "../../../src/types/database";

export default function ReviewReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = useState<LocalReport | null>(null);
  const [defects, setDefects] = useState<LocalDefect[]>([]);
  const [elements, setElements] = useState<LocalRoofElement[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogAction, setDialogAction] = useState<ReviewActionType>("approve");

  const loadReport = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const data = await getReportWithRelations(id);

      if (!data) {
        setError("Report not found");
        return;
      }

      setReport(data.report);
      setDefects(data.defects);
      setElements(data.elements);
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleAction = (action: ReviewActionType) => {
    setDialogAction(action);
    setDialogVisible(true);
  };

  const handleConfirmAction = async (note: string, revisionItems?: string[]) => {
    if (!report) return;

    const reviewerId = "current-user-id"; // Would come from auth context

    let result;
    switch (dialogAction) {
      case "approve":
        result = await reviewService.approveReport(report.id, reviewerId, note);
        break;
      case "reject":
        result = await reviewService.rejectReport(report.id, reviewerId, note);
        break;
      case "revision":
        result = await reviewService.requestRevision(
          report.id,
          reviewerId,
          note,
          revisionItems
        );
        break;
    }

    if (result.success) {
      setDialogVisible(false);
      Alert.alert(
        "Success",
        `Report ${dialogAction === "approve" ? "approved" : dialogAction === "reject" ? "rejected" : "returned for revision"}`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } else {
      throw new Error(result.error || "Action failed");
    }
  };

  const handleFinalise = async () => {
    if (!report) return;

    Alert.alert(
      "Finalise Report",
      "This will lock the report and generate the final PDF. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finalise",
          style: "default",
          onPress: async () => {
            const result = await reviewService.finaliseReport(report.id);
            if (result.success) {
              Alert.alert("Success", "Report has been finalised", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } else {
              Alert.alert("Error", result.error || "Failed to finalise");
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading report...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error Loading Report</Text>
        <Text style={styles.errorText}>{error || "Report not found"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReport}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPendingReview = report.status === "PENDING_REVIEW";
  const isApproved = report.status === "APPROVED";

  return (
    <>
      <Stack.Screen
        options={{
          title: report.reportNumber || "Review Report",
        }}
      />

      <ScrollView style={styles.container}>
        {/* Report Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.reportNumber}>
              {report.reportNumber || "Draft Report"}
            </Text>
            <StatusBadge status={report.status} />
          </View>
          <Text style={styles.address}>{report.propertyAddress}</Text>
          <Text style={styles.city}>
            {report.propertyCity}, {report.propertyRegion}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{defects.length}</Text>
            <Text style={styles.statLabel}>Defects</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{elements.length}</Text>
            <Text style={styles.statLabel}>Elements</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{photos.length}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
        </View>

        {/* Inspection Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspection Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(report.inspectionDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{report.inspectionType.replace(/_/g, " ")}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Property Type</Text>
            <Text style={styles.detailValue}>{report.propertyType.replace(/_/g, " ")}</Text>
          </View>
          {report.weatherConditions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Weather</Text>
              <Text style={styles.detailValue}>{report.weatherConditions}</Text>
            </View>
          )}
          {report.limitations && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Limitations</Text>
              <Text style={styles.detailValue}>{report.limitations}</Text>
            </View>
          )}
        </View>

        {/* Client Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>{report.clientName}</Text>
          </View>
          {report.clientEmail && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{report.clientEmail}</Text>
            </View>
          )}
          {report.clientPhone && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{report.clientPhone}</Text>
            </View>
          )}
        </View>

        {/* Defects Summary */}
        {defects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Defects ({defects.length})</Text>
            {defects.map((defect, index) => (
              <View key={defect.id} style={styles.defectCard}>
                <View style={styles.defectHeader}>
                  <Text style={styles.defectNumber}>#{defect.defectNumber}</Text>
                  <SeverityBadge severity={defect.severity} size="sm" />
                </View>
                <Text style={styles.defectTitle}>{defect.title}</Text>
                <Text style={styles.defectLocation}>{defect.location}</Text>
                <Text style={styles.defectObservation} numberOfLines={2}>
                  {defect.observation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Elements Summary */}
        {elements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Roof Elements ({elements.length})</Text>
            {elements.map((element) => (
              <View key={element.id} style={styles.elementCard}>
                <View style={styles.elementHeader}>
                  <Text style={styles.elementType}>
                    {element.elementType.replace(/_/g, " ")}
                  </Text>
                  {element.conditionRating && (
                    <ConditionBadge condition={element.conditionRating} size="sm" />
                  )}
                </View>
                <Text style={styles.elementLocation}>{element.location}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photo Preview */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {photos.slice(0, 6).map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.localUri }}
                    style={styles.photoThumb}
                  />
                ))}
                {photos.length > 6 && (
                  <View style={styles.morePhotos}>
                    <Text style={styles.morePhotosText}>+{photos.length - 6}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Sign-off Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sign-off</Text>
          <View style={styles.signoffStatus}>
            <Text style={styles.signoffIcon}>
              {report.declarationSigned ? "✅" : "⚠️"}
            </Text>
            <Text style={styles.signoffText}>
              Declaration {report.declarationSigned ? "Signed" : "Not Signed"}
            </Text>
          </View>
          {report.submittedAt && (
            <Text style={styles.submittedAt}>
              Submitted: {formatDate(report.submittedAt)}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {isPendingReview && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleAction("approve")}
              >
                <Text style={styles.actionButtonText}>✓ Approve</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.revisionButton]}
                onPress={() => handleAction("revision")}
              >
                <Text style={styles.actionButtonText}>↺ Request Revision</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleAction("reject")}
              >
                <Text style={styles.actionButtonText}>✕ Reject</Text>
              </TouchableOpacity>
            </>
          )}

          {isApproved && (
            <TouchableOpacity
              style={[styles.actionButton, styles.finaliseButton]}
              onPress={handleFinalise}
            >
              <Text style={styles.actionButtonText}>📄 Finalise & Generate PDF</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Review Action Dialog */}
      <ReviewActionDialog
        visible={dialogVisible}
        actionType={dialogAction}
        reportNumber={report.reportNumber || "Draft Report"}
        onConfirm={handleConfirmAction}
        onCancel={() => setDialogVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#7c3aed",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  headerCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  address: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  city: {
    fontSize: 14,
    color: "#6b7280",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#7c3aed",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  section: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  defectCard: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  defectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  defectNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  defectTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  defectLocation: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  defectObservation: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
  },
  elementCard: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  elementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  elementType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  elementLocation: {
    fontSize: 12,
    color: "#6b7280",
  },
  photoRow: {
    flexDirection: "row",
    gap: 8,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  morePhotos: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  morePhotosText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  signoffStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signoffIcon: {
    fontSize: 20,
  },
  signoffText: {
    fontSize: 14,
    color: "#111827",
  },
  submittedAt: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
  },
  actionSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  approveButton: {
    backgroundColor: "#059669",
  },
  revisionButton: {
    backgroundColor: "#d97706",
  },
  rejectButton: {
    backgroundColor: "#dc2626",
  },
  finaliseButton: {
    backgroundColor: "#7c3aed",
  },
});
