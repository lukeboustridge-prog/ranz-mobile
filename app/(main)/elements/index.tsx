/**
 * Element List Screen
 * View all roof elements for a report
 */

import { useState, useCallback } from "react";
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
import type { LocalRoofElement } from "../../../src/types/database";
import { ConditionRating } from "../../../src/types/shared";

const CONDITION_COLORS: Record<ConditionRating, string> = {
  [ConditionRating.GOOD]: "#22c55e",
  [ConditionRating.FAIR]: "#eab308",
  [ConditionRating.POOR]: "#f97316",
  [ConditionRating.CRITICAL]: "#ef4444",
  [ConditionRating.NOT_INSPECTED]: "#6b7280",
};

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  ROOF_CLADDING: "Roof Cladding",
  RIDGE: "Ridge",
  VALLEY: "Valley",
  HIP: "Hip",
  BARGE: "Barge",
  FASCIA: "Fascia",
  GUTTER: "Gutter",
  DOWNPIPE: "Downpipe",
  FLASHING_WALL: "Wall Flashing",
  FLASHING_PENETRATION: "Penetration Flashing",
  FLASHING_PARAPET: "Parapet Flashing",
  SKYLIGHT: "Skylight",
  VENT: "Vent",
  ANTENNA_MOUNT: "Antenna Mount",
  SOLAR_PANEL: "Solar Panel",
  UNDERLAY: "Underlay",
  INSULATION: "Insulation",
  ROOF_STRUCTURE: "Roof Structure",
  OTHER: "Other",
};

export default function ElementListScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { getRoofElements } = useLocalDB();

  const [elements, setElements] = useState<LocalRoofElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadElements = useCallback(async () => {
    if (!reportId) return;
    try {
      const loaded = await getRoofElements(reportId);
      setElements(loaded);
    } catch (error) {
      console.error("Failed to load elements:", error);
    } finally {
      setIsLoading(false);
    }
  }, [reportId, getRoofElements]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadElements();
    }, [loadElements])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadElements();
    setIsRefreshing(false);
  };

  const renderElementCard = ({ item }: { item: LocalRoofElement }) => {
    const conditionColor = item.conditionRating
      ? CONDITION_COLORS[item.conditionRating as ConditionRating]
      : "#6b7280";
    const typeLabel = ELEMENT_TYPE_LABELS[item.elementType] || item.elementType;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({
          pathname: "/(main)/elements/[id]",
          params: { id: item.id, reportId: reportId || "" }
        } as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.typeIcon}>
            <Text style={styles.typeIconText}>🏠</Text>
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.cardTitle}>{typeLabel}</Text>
            {item.conditionRating && (
              <View style={[styles.conditionBadge, { backgroundColor: conditionColor }]}>
                <Text style={styles.conditionText}>
                  {item.conditionRating.replace(/_/g, " ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.locationText}>📍 {item.location}</Text>

        <View style={styles.detailsRow}>
          {item.material && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Material</Text>
              <Text style={styles.detailValue}>{item.material}</Text>
            </View>
          )}
          {item.claddingType && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{item.claddingType}</Text>
            </View>
          )}
          {item.pitch != null && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Pitch</Text>
              <Text style={styles.detailValue}>{item.pitch}°</Text>
            </View>
          )}
          {item.area != null && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Area</Text>
              <Text style={styles.detailValue}>{item.area} m²</Text>
            </View>
          )}
        </View>

        {item.conditionNotes && (
          <Text style={styles.notesText} numberOfLines={2}>
            {item.conditionNotes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🏠</Text>
      <Text style={styles.emptyTitle}>No Elements Documented</Text>
      <Text style={styles.emptySubtitle}>
        Start documenting roof components for this inspection.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push(`/(main)/elements/new?reportId=${reportId}`)}
      >
        <Text style={styles.emptyButtonText}>+ Add First Element</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading elements...</Text>
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
          <Text style={styles.title}>Roof Elements ({elements.length})</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push(`/(main)/elements/new?reportId=${reportId}`)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Element List */}
      <FlatList
        data={elements}
        renderItem={renderElementCard}
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
    fontSize: 24,
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
    marginBottom: 8,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  typeIconText: {
    fontSize: 20,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  locationText: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 8,
  },
  detailItem: {},
  detailLabel: {
    fontSize: 10,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  notesText: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 4,
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
