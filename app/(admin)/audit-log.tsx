/**
 * Audit Log Screen
 * View system activity and changes
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { getAuditLog } from "../../src/lib/sqlite";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  details: string | null;
  createdAt: string;
}

export default function AuditLogScreen() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);

  const loadAuditLog = useCallback(async () => {
    try {
      const log = await getAuditLog(filterType);
      setEntries(log);
    } catch (error) {
      console.error("[AuditLog] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAuditLog();
    setIsRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATED":
        return "➕";
      case "UPDATED":
        return "✏️";
      case "DELETED":
        return "🗑️";
      case "PHOTO_ADDED":
        return "📷";
      case "DEFECT_ADDED":
        return "⚠️";
      case "STATUS_CHANGED":
        return "🔄";
      case "SUBMITTED":
        return "📤";
      case "APPROVED":
        return "✅";
      case "REJECTED":
        return "❌";
      case "PDF_GENERATED":
        return "📄";
      default:
        return "📝";
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATED":
        return "#059669";
      case "DELETED":
        return "#dc2626";
      case "APPROVED":
        return "#059669";
      case "REJECTED":
        return "#dc2626";
      case "SUBMITTED":
        return "#d97706";
      default:
        return "#2d5c8f";
    }
  };

  const filterOptions = [
    { value: null, label: "All" },
    { value: "report", label: "Reports" },
    { value: "photo", label: "Photos" },
    { value: "defect", label: "Defects" },
    { value: "user", label: "Users" },
  ];

  const renderEntry = ({ item }: { item: AuditEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.actionIcon}>{getActionIcon(item.action)}</Text>
        <View style={styles.entryInfo}>
          <Text
            style={[styles.actionText, { color: getActionColor(item.action) }]}
          >
            {item.action.replace(/_/g, " ")}
          </Text>
          <Text style={styles.entityText}>
            {item.entityType} • {item.entityId.substring(0, 8)}...
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
      </View>

      <View style={styles.entryBody}>
        <Text style={styles.userText}>By: {item.userName || "System"}</Text>
        {item.details && (
          <Text style={styles.detailsText} numberOfLines={2}>
            {item.details}
          </Text>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading audit log...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {filterOptions.map((option) => (
          <TouchableOpacity
            key={option.value || "all"}
            style={[
              styles.filterTab,
              filterType === option.value && styles.filterTabActive,
            ]}
            onPress={() => setFilterType(option.value)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === option.value && styles.filterTabTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Entry Count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
        </Text>
      </View>

      {/* Log List */}
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
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
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No Audit Entries</Text>
            <Text style={styles.emptyText}>
              Activity will appear here as users interact with the system
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
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: "#dc2626",
  },
  filterTabText: {
    fontSize: 13,
    color: "#6b7280",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  countBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  countText: {
    fontSize: 12,
    color: "#6b7280",
  },
  listContent: {
    padding: 16,
  },
  entryCard: {
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
  entryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  entryInfo: {
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  entityText: {
    fontSize: 12,
    color: "#6b7280",
  },
  timestamp: {
    fontSize: 11,
    color: "#9ca3af",
  },
  entryBody: {
    marginLeft: 32,
  },
  userText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
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
    paddingHorizontal: 40,
  },
});
