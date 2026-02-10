/**
 * Report Detail Screen
 * View and edit report details, navigate to sub-sections
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLocalDB } from "../../../src/hooks/useLocalDB";
import type { LocalReport, LocalPhoto, LocalDefect, LocalRoofElement } from "../../../src/types/database";

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getReport, getPhotos, getDefects, getRoofElements } = useLocalDB();

  const [report, setReport] = useState<LocalReport | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [defects, setDefects] = useState<LocalDefect[]>([]);
  const [elements, setElements] = useState<LocalRoofElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const loadedReport = await getReport(id!);
      setReport(loadedReport);

      if (loadedReport) {
        const [loadedPhotos, loadedDefects, loadedElements] = await Promise.all([
          getPhotos(id!),
          getDefects(id!),
          getRoofElements(id!),
        ]);
        setPhotos(loadedPhotos);
        setDefects(loadedDefects);
        setElements(loadedElements);
      }
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadReport();
    setIsRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "#6b7280";
      case "IN_PROGRESS":
        return "#2563eb";
      case "PENDING_REVIEW":
        return "#d97706";
      case "APPROVED":
        return "#059669";
      case "FINALISED":
        return "#16a34a";
      default:
        return "#6b7280";
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "#22c55e";
      case "pending":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading report...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Report not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Reports</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {report.reportNumber || "Draft Report"}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
            <Text style={styles.statusText}>{report.status.replace(/_/g, " ")}</Text>
          </View>
        </View>

        <Text style={styles.address}>
          {report.propertyAddress}, {report.propertyCity}
        </Text>

        {/* Sync status */}
        <View style={styles.syncRow}>
          <View style={[styles.syncDot, { backgroundColor: getSyncStatusColor(report.syncStatus) }]} />
          <Text style={styles.syncText}>
            {report.syncStatus === "synced"
              ? `Synced ${report.syncedAt ? formatDate(report.syncedAt) : ""}`
              : report.syncStatus === "pending"
              ? "Pending sync"
              : report.syncStatus === "error"
              ? "Sync failed"
              : "Draft"}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{photos.length}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{defects.length}</Text>
          <Text style={styles.statLabel}>Defects</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{elements.length}</Text>
          <Text style={styles.statLabel}>Elements</Text>
        </View>
      </View>

      {/* Property Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Address</Text>
          <Text style={styles.detailValue}>{report.propertyAddress}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>City</Text>
          <Text style={styles.detailValue}>{report.propertyCity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Region</Text>
          <Text style={styles.detailValue}>{report.propertyRegion}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Property Type</Text>
          <Text style={styles.detailValue}>{report.propertyType.replace(/_/g, " ")}</Text>
        </View>
        {report.buildingAge && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Building Age</Text>
            <Text style={styles.detailValue}>{report.buildingAge} years</Text>
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

      {/* Inspection Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inspection</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{formatDate(report.inspectionDate)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>{report.inspectionType.replace(/_/g, " ")}</Text>
        </View>
        {report.weatherConditions && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Weather</Text>
            <Text style={styles.detailValue}>{report.weatherConditions}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/(main)/photo-capture?reportId=${id}`)}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Capture Photos</Text>
            <Text style={styles.actionSubtitle}>{photos.length} photos captured</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push({
            pathname: "/(main)/defects",
            params: { reportId: id || "" }
          } as any)}
        >
          <Text style={styles.actionIcon}>🔍</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Document Defects</Text>
            <Text style={styles.actionSubtitle}>{defects.length} defects recorded</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push({
            pathname: "/(main)/elements",
            params: { reportId: id || "" }
          } as any)}
        >
          <Text style={styles.actionIcon}>🏠</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Roof Elements</Text>
            <Text style={styles.actionSubtitle}>{elements.length} elements documented</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push({
            pathname: "/(main)/compliance/[reportId]",
            params: { reportId: id || "" }
          } as any)}
        >
          <Text style={styles.actionIcon}>✓</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Compliance Assessment</Text>
            <Text style={styles.actionSubtitle}>Not started</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Button */}
      {report.status !== "FINALISED" && (
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Report Details</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
  backButton: {
    backgroundColor: "#3c4b5d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    paddingTop: 40,
    marginBottom: 20,
  },
  backLink: {
    color: "#3c4b5d",
    fontSize: 16,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  address: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 12,
    color: "#64748b",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
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
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  detailValue: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  actionsSection: {
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 18,
    color: "#94a3b8",
  },
  editButton: {
    backgroundColor: "#3c4b5d",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
