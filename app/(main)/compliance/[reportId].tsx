/**
 * Compliance Assessment Screen
 * Mobile checklist wizard for compliance assessments with standard grouping
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLocalDB } from "../../../src/hooks/useLocalDB";
import type { LocalChecklist, LocalComplianceAssessment } from "../../../src/types/database";
import { ComplianceStatus } from "../../../src/types/shared";

interface ChecklistItem {
  id: string;
  section: string;
  item: string;
  description: string;
  checklistId: string;
  standard: string;
}

interface ItemResult {
  status: ComplianceStatus;
  notes: string;
}

// Standard categories for NZ roofing compliance
const STANDARD_TABS = [
  { id: "all", label: "All", standard: null },
  { id: "e2as1", label: "E2/AS1", standard: "E2/AS1" },
  { id: "metal_cop", label: "Metal Roof COP", standard: "Metal Roof Code of Practice" },
  { id: "b2", label: "B2", standard: "B2" },
];

const STATUS_OPTIONS: { value: ComplianceStatus; label: string; color: string }[] = [
  { value: ComplianceStatus.PASS, label: "Pass", color: "#22c55e" },
  { value: ComplianceStatus.FAIL, label: "Fail", color: "#ef4444" },
  { value: ComplianceStatus.PARTIAL, label: "Partial", color: "#f59e0b" },
  { value: ComplianceStatus.NOT_APPLICABLE, label: "N/A", color: "#6b7280" },
];

export default function ComplianceScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { getChecklists, getComplianceAssessment, saveComplianceAssessment } = useLocalDB();

  const [checklists, setChecklists] = useState<LocalChecklist[]>([]);
  const [allItems, setAllItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Map<string, ItemResult>>(new Map());
  const [selectedStandard, setSelectedStandard] = useState<string>("all");
  const [currentSection, setCurrentSection] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [existingAssessment, setExistingAssessment] = useState<LocalComplianceAssessment | null>(null);

  useEffect(() => {
    loadData();
  }, [reportId]);

  const loadData = async () => {
    if (!reportId) return;
    setIsLoading(true);
    try {
      // Load all available checklists
      const loadedChecklists = await getChecklists();
      setChecklists(loadedChecklists);

      // Parse all checklist items
      const items: ChecklistItem[] = [];
      loadedChecklists.forEach((checklist) => {
        try {
          const parsedItems = JSON.parse(checklist.itemsJson) as Array<{
            id: string;
            section: string;
            item: string;
            description: string;
          }>;

          if (Array.isArray(parsedItems)) {
            parsedItems.forEach((item) => {
              items.push({
                id: `${checklist.id}_${item.id}`,
                section: item.section || "General",
                item: item.item,
                description: item.description,
                checklistId: checklist.id,
                standard: checklist.standard || "General",
              });
            });
          }
        } catch (error) {
          console.error(`Failed to parse checklist ${checklist.id}:`, error);
        }
      });
      setAllItems(items);

      // Set initial section
      const sections = getAvailableSections(items, "all");
      if (sections.length > 0) {
        setCurrentSection(sections[0]);
      }

      // Load existing assessment
      const existing = await getComplianceAssessment(reportId);
      if (existing) {
        setExistingAssessment(existing);
        const resultsMap = new Map<string, ItemResult>();
        const checklistResults = JSON.parse(existing.checklistResultsJson) as Record<
          string,
          Record<string, ComplianceStatus>
        >;

        for (const [checklistId, itemResults] of Object.entries(checklistResults)) {
          for (const [itemId, status] of Object.entries(itemResults)) {
            const fullId = `${checklistId}_${itemId}`;
            resultsMap.set(fullId, { status, notes: "" });
          }
        }
        setResults(resultsMap);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      Alert.alert("Error", "Failed to load compliance data");
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableSections = (items: ChecklistItem[], standard: string): string[] => {
    const filtered = standard === "all"
      ? items
      : items.filter((i) => i.standard === STANDARD_TABS.find((t) => t.id === standard)?.standard);

    const sectionSet = new Set<string>();
    filtered.forEach((item) => sectionSet.add(item.section));
    return Array.from(sectionSet);
  };

  const getFilteredItems = useCallback(() => {
    let filtered = allItems;

    // Filter by standard
    if (selectedStandard !== "all") {
      const standardValue = STANDARD_TABS.find((t) => t.id === selectedStandard)?.standard;
      filtered = filtered.filter((item) => item.standard === standardValue);
    }

    // Filter by section
    if (currentSection) {
      filtered = filtered.filter((item) => item.section === currentSection);
    }

    return filtered;
  }, [allItems, selectedStandard, currentSection]);

  const getAvailableStandards = (): typeof STANDARD_TABS => {
    const standardsInData = new Set(allItems.map((i) => i.standard));
    return STANDARD_TABS.filter(
      (tab) => tab.id === "all" || standardsInData.has(tab.standard || "")
    );
  };

  const updateItemStatus = (id: string, status: ComplianceStatus) => {
    setResults((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(id) || { status: ComplianceStatus.NOT_INSPECTED, notes: "" };
      newMap.set(id, { ...existing, status });
      return newMap;
    });
  };

  const updateItemNotes = (id: string, notes: string) => {
    setResults((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(id) || { status: ComplianceStatus.NOT_INSPECTED, notes: "" };
      newMap.set(id, { ...existing, notes });
      return newMap;
    });
  };

  const saveResults = async () => {
    if (!reportId) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      // Build checklist results structure grouped by checklist ID
      const checklistResults: Record<string, Record<string, ComplianceStatus>> = {};

      for (const [fullId, result] of results.entries()) {
        if (result.status !== ComplianceStatus.NOT_INSPECTED) {
          // Parse checklist ID and item ID from full ID
          const [checklistId, ...itemIdParts] = fullId.split("_");
          const itemId = itemIdParts.join("_");

          if (!checklistResults[checklistId]) {
            checklistResults[checklistId] = {};
          }
          checklistResults[checklistId][itemId] = result.status;
        }
      }

      // Build non-compliance summary
      const nonCompliantItems = allItems.filter((item) => {
        const result = results.get(item.id);
        return result && result.status === ComplianceStatus.FAIL;
      });

      const nonComplianceSummary =
        nonCompliantItems.length > 0
          ? nonCompliantItems
              .map((item) => `[${item.standard}] ${item.item}: ${item.description}`)
              .join("\n\n")
          : null;

      const assessment: LocalComplianceAssessment = {
        id: existingAssessment?.id || `${reportId}_compliance`,
        reportId,
        checklistResultsJson: JSON.stringify(checklistResults),
        nonComplianceSummary,
        syncStatus: "pending",
        createdAt: existingAssessment?.createdAt || now,
        updatedAt: now,
        syncedAt: null,
      };

      await saveComplianceAssessment(assessment);

      // Mark report as dirty for sync
      if (Platform.OS !== "web") {
        const sqlite = await import("../../../src/lib/sqlite");
        await sqlite.markReportDirty(reportId);
      }

      Alert.alert("Success", "Compliance assessment saved", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to save results:", error);
      Alert.alert("Error", "Failed to save compliance assessment");
    } finally {
      setIsSaving(false);
    }
  };

  const getProgress = () => {
    const total = allItems.length;
    const assessed = Array.from(results.values()).filter(
      (r) => r.status !== ComplianceStatus.NOT_INSPECTED
    ).length;
    return { assessed, total, percentage: total > 0 ? (assessed / total) * 100 : 0 };
  };

  const getStandardProgress = (standardId: string) => {
    let items = allItems;
    if (standardId !== "all") {
      const standardValue = STANDARD_TABS.find((t) => t.id === standardId)?.standard;
      items = allItems.filter((i) => i.standard === standardValue);
    }

    const assessed = items.filter((i) => {
      const result = results.get(i.id);
      return result && result.status !== ComplianceStatus.NOT_INSPECTED;
    }).length;

    const failed = items.filter((i) => {
      const result = results.get(i.id);
      return result && result.status === ComplianceStatus.FAIL;
    }).length;

    return { assessed, total: items.length, failed };
  };

  const getSectionProgress = (section: string) => {
    let items = allItems.filter((i) => i.section === section);
    if (selectedStandard !== "all") {
      const standardValue = STANDARD_TABS.find((t) => t.id === selectedStandard)?.standard;
      items = items.filter((i) => i.standard === standardValue);
    }

    const assessed = items.filter((i) => {
      const result = results.get(i.id);
      return result && result.status !== ComplianceStatus.NOT_INSPECTED;
    }).length;

    return { assessed, total: items.length };
  };

  const handleStandardChange = (standardId: string) => {
    setSelectedStandard(standardId);
    const sections = getAvailableSections(allItems, standardId);
    if (sections.length > 0 && !sections.includes(currentSection)) {
      setCurrentSection(sections[0]);
    }
  };

  if (!reportId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Report ID is required</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading compliance data...</Text>
      </View>
    );
  }

  if (allItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Compliance Assessment</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No checklists available</Text>
          <Text style={styles.emptySubtitle}>
            Sync your device to download compliance checklists
          </Text>
        </View>
      </View>
    );
  }

  const progress = getProgress();
  const currentItems = getFilteredItems();
  const availableStandards = getAvailableStandards();
  const sections = getAvailableSections(allItems, selectedStandard);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Compliance Assessment</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress.percentage}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress.assessed}/{progress.total} items assessed
          </Text>
        </View>
      </View>

      {/* Standard Tabs */}
      {availableStandards.length > 1 && (
        <View style={styles.standardTabs}>
          {availableStandards.map((tab) => {
            const tabProgress = getStandardProgress(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.standardTab,
                  selectedStandard === tab.id && styles.standardTabActive,
                ]}
                onPress={() => handleStandardChange(tab.id)}
              >
                <Text
                  style={[
                    styles.standardTabText,
                    selectedStandard === tab.id && styles.standardTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View style={styles.standardTabMeta}>
                  <Text style={styles.standardTabCount}>
                    {tabProgress.assessed}/{tabProgress.total}
                  </Text>
                  {tabProgress.failed > 0 && (
                    <View style={styles.failBadge}>
                      <Text style={styles.failBadgeText}>{tabProgress.failed}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Section Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionTabs}
        contentContainerStyle={styles.sectionTabsContent}
      >
        {sections.map((section) => {
          const sectionProgress = getSectionProgress(section);
          const isComplete = sectionProgress.assessed === sectionProgress.total && sectionProgress.total > 0;
          return (
            <TouchableOpacity
              key={section}
              style={[
                styles.sectionTab,
                currentSection === section && styles.sectionTabActive,
                isComplete && styles.sectionTabComplete,
              ]}
              onPress={() => setCurrentSection(section)}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  currentSection === section && styles.sectionTabTextActive,
                ]}
                numberOfLines={1}
              >
                {section}
              </Text>
              <Text style={styles.sectionTabCount}>
                {sectionProgress.assessed}/{sectionProgress.total}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Checklist Items */}
      <ScrollView style={styles.itemsList} contentContainerStyle={styles.itemsListContent}>
        {currentItems.map((item) => {
          const result = results.get(item.id) || {
            status: ComplianceStatus.NOT_INSPECTED,
            notes: "",
          };
          const isExpanded = expandedItem === item.id;
          const statusOption = STATUS_OPTIONS.find((s) => s.value === result.status);

          return (
            <View key={item.id} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemHeader}
                onPress={() => setExpandedItem(isExpanded ? null : item.id)}
              >
                <View style={styles.itemInfo}>
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemStandard}>{item.standard}</Text>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.item}
                  </Text>
                </View>
                {result.status !== ComplianceStatus.NOT_INSPECTED && (
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusOption?.color || "#6b7280" },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {statusOption?.label || result.status}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.itemExpanded}>
                  <Text style={styles.itemDescription}>{item.description}</Text>

                  {/* Status Selection */}
                  <Text style={styles.fieldLabel}>Assessment Status</Text>
                  <View style={styles.statusOptions}>
                    {STATUS_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.statusOption,
                          result.status === option.value && {
                            backgroundColor: option.color,
                            borderColor: option.color,
                          },
                        ]}
                        onPress={() => updateItemStatus(item.id, option.value)}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            result.status === option.value && styles.statusOptionTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Notes */}
                  <Text style={styles.fieldLabel}>Notes (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={result.notes}
                    onChangeText={(text) => updateItemNotes(item.id, text)}
                    placeholder="Add assessment notes..."
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}
            </View>
          );
        })}

        {currentItems.length === 0 && (
          <View style={styles.noItemsState}>
            <Text style={styles.noItemsText}>No items in this section</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bar with Non-Compliance Summary & Save */}
      <View style={styles.bottomBar}>
        {/* Non-compliance count */}
        {Array.from(results.values()).filter((r) => r.status === ComplianceStatus.FAIL).length > 0 && (
          <View style={styles.nonComplianceWarning}>
            <Text style={styles.nonComplianceText}>
              {Array.from(results.values()).filter((r) => r.status === ComplianceStatus.FAIL).length} non-compliance items found
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveResults}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save Assessment"}
          </Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backLink: {
    color: "#3c4b5d",
    fontSize: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
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
  emptyState: {
    flex: 1,
    justifyContent: "center",
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
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  standardTabs: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  standardTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  standardTabActive: {
    backgroundColor: "#3c4b5d",
  },
  standardTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  standardTabTextActive: {
    color: "#ffffff",
  },
  standardTabMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  standardTabCount: {
    fontSize: 10,
    color: "#94a3b8",
  },
  failBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  failBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
  },
  sectionTabs: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    maxHeight: 60,
  },
  sectionTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  sectionTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
  },
  sectionTabActive: {
    backgroundColor: "#3c4b5d",
  },
  sectionTabComplete: {
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    maxWidth: 100,
  },
  sectionTabTextActive: {
    color: "#ffffff",
  },
  sectionTabCount: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    padding: 12,
    paddingBottom: 140,
  },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  itemStandard: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3c4b5d",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemTitle: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  itemExpanded: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  itemDescription: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 8,
  },
  statusOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  statusOptionTextActive: {
    color: "#ffffff",
  },
  notesInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1f2937",
    minHeight: 80,
    textAlignVertical: "top",
  },
  noItemsState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  noItemsText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  nonComplianceWarning: {
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  nonComplianceText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
