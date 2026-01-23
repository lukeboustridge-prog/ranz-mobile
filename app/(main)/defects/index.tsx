/**
 * Defect List Screen
 * View all defects for a report
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useLocalDB } from "../../../src/hooks/useLocalDB";
import type { LocalDefect } from "../../../src/types/database";
import { DefectSeverity } from "../../../src/types/shared";

const SEVERITY_COLORS: Record<DefectSeverity, string> = {
  [DefectSeverity.CRITICAL]: "#ef4444",
  [DefectSeverity.HIGH]: "#f97316",
  [DefectSeverity.MEDIUM]: "#eab308",
  [DefectSeverity.LOW]: "#22c55e",
};

export default function DefectListScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { getDefects } = useLocalDB();

  const [defects, setDefects] = useState<LocalDefect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDefects = useCallback(async () => {
    if (!reportId) return;
    try {
      const loaded = await getDefects(reportId);
      setDefects(loaded.sort((a, b) => a.defectNumber - b.defectNumber));
    } catch (error) {
      console.error("Failed to load defects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [reportId, getDefects]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDefects();
    }, [loadDefects])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDefects();
    setIsRefreshing(false);
  };

  const renderDefectCard = ({ item }: { item: LocalDefect }) => {
    const severityColor = SEVERITY_COLORS[item.severity as DefectSeverity] || "#6b7280";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({
          pathname: "/(main)/defects/[id]",
          params: { id: item.id, reportId: reportId || "" }
        } as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>#{item.defectNumber}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
            <Text style={styles.severityText}>{item.severity}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.observation}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.locationText}>📍 {item.location}</Text>
          <View style={styles.classificationBadge}>
            <Text style={styles.classificationText}>
              {item.classification.replace(/_/g, " ")}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No Defects Recorded</Text>
      <Text style={styles.emptySubtitle}>
        Start documenting defects found during the inspection.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push(`/(main)/defects/new?reportId=${reportId}`)}
      >
        <Text style={styles.emptyButtonText}>+ Add First Defect</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading defects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Defects ({defects.length})</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push(`/(main)/defects/new?reportId=${reportId}`)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Defect List */}
      <FlatList
        data={defects}
        renderItem={renderDefectCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
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
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#f8fafc",
  },
  backButton: {
    color: "#2d5c8f",
    fontSize: 16,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e293b",
  },
  addButton: {
    backgroundColor: "#2d5c8f",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  numberBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  numberText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },
  classificationBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  classificationText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748b",
    textTransform: "uppercase",
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  emptyButton: {
    backgroundColor: "#2d5c8f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
