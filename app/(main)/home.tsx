/**
 * Home Screen
 * Main dashboard showing reports and sync status
 */

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, Image } from "react-native";
import { useAuthStore } from "../../src/stores/auth-store";
import { Link, useRouter } from "expo-router";
import { OfflineIndicator } from "../../src/components/OfflineIndicator";
import { COLORS } from "../../src/lib/theme";
import type { LocalReport } from "../../src/types/database";

// SQLite is not supported on web - only import on native
const isNative = Platform.OS !== "web";

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [reports, setReports] = useState<LocalReport[]>([]);
  const [stats, setStats] = useState({ reports: 0, photos: 0, defects: 0, elements: 0, pendingSync: 0, checklists: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = async () => {
    if (!isNative) {
      // Web mode - show demo data or empty state
      console.log("[Home] Running in web mode - SQLite not available");
      return;
    }

    try {
      const sqlite = await import("../../src/lib/sqlite");
      const [allReports, dbStats] = await Promise.all([
        sqlite.getAllReports(),
        sqlite.getDatabaseStats(),
      ]);
      setReports(allReports);
      setStats(dbStats);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  useEffect(() => {
    // Load local data first (instant)
    loadData();

    // Then bootstrap sync from server (user is authenticated at this point)
    if (isNative) {
      setIsSyncing(true);
      setSyncError(null);
      import("../../src/services/sync-service")
        .then(async ({ initializeSyncEngine }) => {
          try {
            const result = await initializeSyncEngine();
            console.log("[Home] Bootstrap result:", JSON.stringify(result));
            if (!result.success && result.errors.length > 0) {
              const errMsg = result.errors.map((e: { code: string; message: string }) => `${e.code}: ${e.message}`).join("; ");
              console.error("[Home] Bootstrap errors:", errMsg);
              setSyncError(errMsg);
            }
            // Reload local data after sync completes
            await loadData();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[Home] Bootstrap sync failed:", msg);
            setSyncError(msg);
          } finally {
            setIsSyncing(false);
          }
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[Home] Failed to import sync service:", msg);
          setSyncError(`Import failed: ${msg}`);
          setIsSyncing(false);
        });
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (isNative) {
        // Sync from server first, then reload local data
        const { fullSync } = await import("../../src/services/sync-service");
        await fullSync();
      }
      await loadData();
    } catch (error) {
      console.error("Refresh failed:", error);
      // Still reload local data even if sync fails
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
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

  const renderReportItem = ({ item }: { item: LocalReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => router.push(`/(main)/report-detail/${item.id}`)}
    >
      <View style={styles.reportHeader}>
        <Text style={styles.reportNumber}>{item.reportNumber || "Draft"}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace(/_/g, " ")}</Text>
        </View>
      </View>
      <Text style={styles.reportAddress} numberOfLines={1}>
        {item.propertyAddress}, {item.propertyCity}
      </Text>
      <View style={styles.reportMeta}>
        <Text style={styles.reportDate}>{formatDate(item.inspectionDate)}</Text>
        {item.syncStatus !== "synced" && (
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>
              {item.syncStatus === "pending" ? "Pending sync" : item.syncStatus}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Branded Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0] || "Inspector"}</Text>
      </View>

      {/* Offline Indicator - slides down when offline */}
      <OfflineIndicator />

      {/* Sync Status */}
      {isSyncing && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>Syncing reports from server...</Text>
        </View>
      )}
      {syncError && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => setSyncError(null)}>
          <Text style={styles.errorBannerText}>Sync error: {syncError}</Text>
          <Text style={styles.errorDismiss}>Tap to dismiss</Text>
        </TouchableOpacity>
      )}

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.reports}</Text>
          <Text style={styles.statLabel}>Reports</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.photos}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
        <View style={[styles.statCard, stats.pendingSync > 0 && styles.statCardWarning]}>
          <Text style={[styles.statNumber, stats.pendingSync > 0 && styles.statNumberWarning]}>
            {stats.pendingSync}
          </Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
        </View>
      </View>

      {/* New Report Button */}
      <TouchableOpacity
        style={styles.newReportButton}
        onPress={() => router.push("/(main)/new-report")}
      >
        <Text style={styles.newReportText}>+ New Inspection Report</Text>
      </TouchableOpacity>

      {/* Reports List */}
      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>Recent Reports</Text>
        <FlatList
          data={reports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No reports yet</Text>
              <Text style={styles.emptySubtext}>Tap "New Inspection Report" to get started</Text>
            </View>
          }
          contentContainerStyle={reports.length === 0 ? styles.emptyContainer : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: COLORS.primary[500],
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
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
  statCardWarning: {
    backgroundColor: "#fef3c7",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e293b",
  },
  statNumberWarning: {
    color: "#d97706",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  newReportButton: {
    marginHorizontal: 20,
    backgroundColor: COLORS.primary[500],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  newReportText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  reportsSection: {
    flex: 1,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  reportCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  reportAddress: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  reportMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reportDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  syncBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 10,
    color: "#d97706",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },
  syncBanner: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  syncBannerText: {
    fontSize: 13,
    color: "#1e40af",
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontSize: 12,
    color: "#991b1b",
  },
  errorDismiss: {
    fontSize: 11,
    color: "#dc2626",
    marginTop: 4,
  },
});
