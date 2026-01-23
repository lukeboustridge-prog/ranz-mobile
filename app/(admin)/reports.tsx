/**
 * Admin Reports Screen
 * View and manage all reports in the system
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
import { getAllReports, searchReports } from "../../src/lib/sqlite";
import type { LocalReport } from "../../src/types/database";
import { ReportStatus } from "../../src/types/shared";

export default function AdminReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"date" | "status">("date");

  const loadReports = useCallback(async () => {
    try {
      let result: LocalReport[];

      if (searchQuery.trim()) {
        result = await searchReports(searchQuery.trim());
      } else {
        result = await getAllReports();
      }

      setReports(result);
    } catch (error) {
      console.error("[AdminReports] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadReports();
    setIsRefreshing(false);
  };

  const handleReportPress = (report: LocalReport) => {
    // Navigate to review screen if pending, otherwise to detail
    if (report.status === "PENDING_REVIEW") {
      router.push(`/(review)/report/${report.id}`);
    } else {
      router.push(`/(main)/report-detail/${report.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const filteredReports = reports
    .filter((report) => {
      if (statusFilter !== "ALL" && report.status !== statusFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else {
        return a.status.localeCompare(b.status);
      }
    });

  const statusOptions = [
    "ALL" as const,
    ReportStatus.DRAFT,
    ReportStatus.IN_PROGRESS,
    ReportStatus.PENDING_REVIEW,
    ReportStatus.APPROVED,
    ReportStatus.FINALISED,
  ];

  const renderReportItem = ({ item }: { item: LocalReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => handleReportPress(item)}
    >
      <View style={styles.reportHeader}>
        <Text style={styles.reportNumber}>
          {item.reportNumber || "Draft Report"}
        </Text>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <Text style={styles.address} numberOfLines={2}>
        {item.propertyAddress}
      </Text>

      <View style={styles.reportMeta}>
        <Text style={styles.metaText}>
          Client: {item.clientName}
        </Text>
        <Text style={styles.metaText}>
          {item.propertyCity}
        </Text>
      </View>

      <View style={styles.reportFooter}>
        <Text style={styles.dateText}>
          Inspected: {formatDate(item.inspectionDate)}
        </Text>
        <Text style={styles.dateText}>
          Updated: {formatDate(item.updatedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by address, client, or report number..."
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          onSubmitEditing={loadReports}
        />
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusOptions}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                statusFilter === item && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === item && styles.filterChipTextActive,
                ]}
              >
                {item === "ALL" ? "All" : item.replace(/_/g, " ")}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Sort Options */}
      <View style={styles.sortBar}>
        <Text style={styles.resultCount}>
          {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""}
        </Text>
        <View style={styles.sortOptions}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === "date" && styles.sortButtonActive]}
            onPress={() => setSortBy("date")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortBy === "date" && styles.sortButtonTextActive,
              ]}
            >
              Date
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === "status" && styles.sortButtonActive]}
            onPress={() => setSortBy("status")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortBy === "status" && styles.sortButtonTextActive,
              ]}
            >
              Status
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
            colors={["#dc2626"]}
            tintColor="#dc2626"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Reports Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "Try adjusting your search"
                : "No reports match the selected filter"}
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
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#dc2626",
  },
  filterChipText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  sortBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  resultCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  sortOptions: {
    flexDirection: "row",
    gap: 8,
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  sortButtonActive: {
    backgroundColor: "#f3f4f6",
  },
  sortButtonText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  sortButtonTextActive: {
    color: "#111827",
    fontWeight: "500",
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
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
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
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: "#6b7280",
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
  },
  dateText: {
    fontSize: 11,
    color: "#9ca3af",
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
