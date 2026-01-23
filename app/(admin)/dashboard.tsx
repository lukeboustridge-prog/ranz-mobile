/**
 * Admin Dashboard Screen
 * Overview of system statistics and quick actions
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { getReportCountsByStatus, getAllReports } from "../../src/lib/sqlite";
import type { LocalReport } from "../../src/types/database";

interface DashboardStats {
  reportCounts: Record<string, number>;
  totalReports: number;
  recentReports: LocalReport[];
  inspectorCount: number;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [reportCounts, allReports] = await Promise.all([
        getReportCountsByStatus(),
        getAllReports(),
      ]);

      // Get unique inspectors
      const uniqueInspectors = new Set(allReports.map((r) => r.inspectorId || "unknown"));

      // Get recent reports (last 5)
      const recentReports = allReports
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

      setStats({
        reportCounts,
        totalReports: allReports.length,
        recentReports,
        inspectorCount: uniqueInspectors.size,
      });
    } catch (error) {
      console.error("[AdminDashboard] Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStats();
    setIsRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={["#dc2626"]}
          tintColor="#dc2626"
        />
      }
    >
      {/* Stats Overview */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statValue}>{stats?.totalReports || 0}</Text>
          <Text style={styles.statLabel}>Total Reports</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.reportCounts?.PENDING_REVIEW || 0}</Text>
          <Text style={styles.statLabel}>Pending Review</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.reportCounts?.APPROVED || 0}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.inspectorCount || 0}</Text>
          <Text style={styles.statLabel}>Inspectors</Text>
        </View>
      </View>

      {/* Status Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report Status Breakdown</Text>
        <View style={styles.statusList}>
          {[
            { key: "DRAFT", label: "Draft", color: "#6b7280" },
            { key: "IN_PROGRESS", label: "In Progress", color: "#2563eb" },
            { key: "PENDING_REVIEW", label: "Pending Review", color: "#d97706" },
            { key: "APPROVED", label: "Approved", color: "#059669" },
            { key: "FINALISED", label: "Finalised", color: "#7c3aed" },
          ].map((status) => (
            <View key={status.key} style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={styles.statusLabel}>{status.label}</Text>
              </View>
              <Text style={styles.statusCount}>
                {stats?.reportCounts?.[status.key] || 0}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(review)/queue")}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>Review Queue</Text>
            <Text style={styles.actionCount}>
              {stats?.reportCounts?.PENDING_REVIEW || 0} pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(admin)/users")}
          >
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionLabel}>Users</Text>
            <Text style={styles.actionCount}>{stats?.inspectorCount || 0} active</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(admin)/reports")}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>All Reports</Text>
            <Text style={styles.actionCount}>{stats?.totalReports || 0} total</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(admin)/audit-log")}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionLabel}>Audit Log</Text>
            <Text style={styles.actionCount}>View history</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {stats?.recentReports && stats.recentReports.length > 0 ? (
          stats.recentReports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={styles.activityItem}
              onPress={() => router.push(`/(main)/report-detail/${report.id}`)}
            >
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {report.propertyAddress}
                </Text>
                <Text style={styles.activityMeta}>
                  {report.reportNumber || "Draft"} • {report.status.replace(/_/g, " ")}
                </Text>
              </View>
              <Text style={styles.activityTime}>{formatDate(report.updatedAt)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent activity</Text>
        )}
      </View>

      {/* System Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Database Version</Text>
          <Text style={styles.infoValue}>v7</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Sync</Text>
          <Text style={styles.infoValue}>
            {new Date().toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: 40 }} />
    </ScrollView>
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardPrimary: {
    backgroundColor: "#dc2626",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  statusList: {
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: "#374151",
  },
  statusCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  actionCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  activityMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  activityTime: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
});
