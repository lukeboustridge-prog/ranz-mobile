/**
 * Review Queue Screen
 * Shows reports pending review for reviewers
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBadge } from "../../src/components/badges";
import { useReviewStore } from "../../src/stores/review-store";
import { reviewService } from "../../src/services/review-service";
import { getReportsPendingReview, getReportCountsByStatus } from "../../src/lib/sqlite";
import type { LocalReport } from "../../src/types/database";

export default function ReviewQueueScreen() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PENDING_REVIEW" | "APPROVED">("PENDING_REVIEW");

  const {
    selectedReportIds,
    toggleReportSelection,
    clearSelection,
    selectAllReports,
  } = useReviewStore();

  const loadData = useCallback(async () => {
    try {
      const [pendingReports, statusCounts] = await Promise.all([
        getReportsPendingReview(),
        getReportCountsByStatus(),
      ]);
      setReports(pendingReports);
      setCounts(statusCounts);
    } catch (error) {
      console.error("[ReviewQueue] Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleReportPress = (report: LocalReport) => {
    router.push(`/(review)/report/${report.id}`);
  };

  const handleSelectAll = () => {
    if (selectedReportIds.length === reports.length) {
      clearSelection();
    } else {
      selectAllReports(reports.map((r) => r.id));
    }
  };

  const filteredReports = reports.filter((report) => {
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesAddress = report.propertyAddress?.toLowerCase().includes(query);
      const matchesClient = report.clientName?.toLowerCase().includes(query);
      const matchesNumber = report.reportNumber?.toLowerCase().includes(query);
      if (!matchesAddress && !matchesClient && !matchesNumber) {
        return false;
      }
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderReportItem = ({ item }: { item: LocalReport }) => {
    const isSelected = selectedReportIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.reportCard, isSelected && styles.reportCardSelected]}
        onPress={() => handleReportPress(item)}
        onLongPress={() => toggleReportSelection(item.id)}
      >
        <View style={styles.reportHeader}>
          <View style={styles.reportInfo}>
            <Text style={styles.reportNumber}>
              {item.reportNumber || "Draft Report"}
            </Text>
            <StatusBadge status={item.status} size="sm" />
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.address} numberOfLines={2}>
          {item.propertyAddress}
        </Text>

        <View style={styles.reportMeta}>
          <Text style={styles.metaText}>
            Client: {item.clientName}
          </Text>
          <Text style={styles.metaText}>
            Inspected: {formatDate(item.inspectionDate)}
          </Text>
        </View>

        {item.submittedAt && (
          <Text style={styles.submittedAt}>
            Submitted: {formatDate(item.submittedAt)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading review queue...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <TouchableOpacity
          style={[
            styles.statItem,
            activeFilter === "PENDING_REVIEW" && styles.statItemActive,
          ]}
          onPress={() => setActiveFilter("PENDING_REVIEW")}
        >
          <Text style={styles.statValue}>{counts.PENDING_REVIEW || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            activeFilter === "APPROVED" && styles.statItemActive,
          ]}
          onPress={() => setActiveFilter("APPROVED")}
        >
          <Text style={styles.statValue}>{counts.APPROVED || 0}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{counts.FINALISED || 0}</Text>
          <Text style={styles.statLabel}>Finalised</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by address, client, or report number..."
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearch}
            onPress={() => setSearchQuery("")}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selection Actions */}
      {selectedReportIds.length > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {selectedReportIds.length} selected
          </Text>
          <TouchableOpacity style={styles.selectAllButton} onPress={handleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedReportIds.length === reports.length ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={clearSelection}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report List */}
      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={renderReportItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#7c3aed"]}
            tintColor="#7c3aed"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Reports</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No reports match your search"
                : "No reports are pending review"}
            </Text>
          </View>
        }
      />
    </View>
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
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  statItemActive: {
    backgroundColor: "#ede9fe",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    position: "relative",
  },
  searchInput: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  clearSearch: {
    position: "absolute",
    right: 28,
    top: "50%",
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  clearSearchText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  selectionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  selectAllText: {
    color: "#fff",
    fontSize: 14,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reportCardSelected: {
    borderWidth: 2,
    borderColor: "#7c3aed",
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reportInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  reportNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  address: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  reportMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#6b7280",
  },
  submittedAt: {
    fontSize: 12,
    color: "#d97706",
    marginTop: 8,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
