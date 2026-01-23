/**
 * Compliance Assessment Screen
 * Mobile checklist wizard for compliance assessments
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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLocalDB } from "../../src/hooks/useLocalDB";
import type { LocalChecklist, LocalComplianceResult } from "../../src/types/database";

type ComplianceStatus = "COMPLIANT" | "NON_COMPLIANT" | "PARTIAL" | "NOT_ASSESSED" | "NOT_APPLICABLE";

interface ChecklistItem {
  ref: string;
  item: string;
  description: string;
  section: string;
}

interface ItemResult {
  status: ComplianceStatus;
  notes: string;
}

const STATUS_OPTIONS: { value: ComplianceStatus; label: string; color: string }[] = [
  { value: "COMPLIANT", label: "Compliant", color: "#22c55e" },
  { value: "NON_COMPLIANT", label: "Non-Compliant", color: "#ef4444" },
  { value: "PARTIAL", label: "Partial", color: "#f59e0b" },
  { value: "NOT_APPLICABLE", label: "N/A", color: "#6b7280" },
];

export default function ComplianceAssessmentScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { getChecklists, getComplianceResults, saveComplianceResult } = useLocalDB();

  const [checklists, setChecklists] = useState<LocalChecklist[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<LocalChecklist | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Map<string, ItemResult>>(new Map());
  const [currentSection, setCurrentSection] = useState<string>("");
  const [sections, setSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load available checklists
      const loadedChecklists = await getChecklists();
      setChecklists(loadedChecklists);

      // Auto-select first checklist if only one
      if (loadedChecklists.length === 1) {
        selectChecklist(loadedChecklists[0]);
      }

      // Load existing results for this report
      if (reportId) {
        const existingResults = await getComplianceResults(reportId);
        const resultsMap = new Map<string, ItemResult>();
        existingResults.forEach((r) => {
          resultsMap.set(r.itemRef, {
            status: r.status as ComplianceStatus,
            notes: r.notes || "",
          });
        });
        setResults(resultsMap);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectChecklist = (checklist: LocalChecklist) => {
    setSelectedChecklist(checklist);

    // Parse checklist definition
    try {
      const def = JSON.parse(checklist.definition);
      const items: ChecklistItem[] = [];
      const sectionSet = new Set<string>();

      // Extract items from sections
      if (def.sections && Array.isArray(def.sections)) {
        def.sections.forEach((section: { title: string; items?: Array<{ ref: string; item: string; description: string }> }) => {
          sectionSet.add(section.title);
          if (section.items && Array.isArray(section.items)) {
            section.items.forEach((item) => {
              items.push({
                ref: item.ref,
                item: item.item,
                description: item.description,
                section: section.title,
              });
            });
          }
        });
      }

      setChecklistItems(items);
      const sectionArray = Array.from(sectionSet);
      setSections(sectionArray);
      if (sectionArray.length > 0) {
        setCurrentSection(sectionArray[0]);
      }
    } catch (error) {
      console.error("Failed to parse checklist:", error);
      Alert.alert("Error", "Failed to load checklist items");
    }
  };

  const getCurrentSectionItems = useCallback(() => {
    return checklistItems.filter((item) => item.section === currentSection);
  }, [checklistItems, currentSection]);

  const updateItemStatus = (ref: string, status: ComplianceStatus) => {
    setResults((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(ref) || { status: "NOT_ASSESSED", notes: "" };
      newMap.set(ref, { ...existing, status });
      return newMap;
    });
  };

  const updateItemNotes = (ref: string, notes: string) => {
    setResults((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(ref) || { status: "NOT_ASSESSED", notes: "" };
      newMap.set(ref, { ...existing, notes });
      return newMap;
    });
  };

  const saveResults = async () => {
    if (!reportId || !selectedChecklist) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      // Save each result
      for (const [itemRef, result] of results.entries()) {
        const item = checklistItems.find((i) => i.ref === itemRef);
        if (!item || result.status === "NOT_ASSESSED") continue;

        const complianceResult: LocalComplianceResult = {
          id: `${reportId}_${selectedChecklist.id}_${itemRef}`,
          reportId,
          checklistId: selectedChecklist.id,
          itemRef,
          itemDescription: item.description,
          status: result.status,
          notes: result.notes || null,
          evidencePhotoIds: null,
          assessedAt: now,
          syncStatus: "pending",
          createdAt: now,
          updatedAt: now,
        };

        await saveComplianceResult(complianceResult);
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
    const total = checklistItems.length;
    const assessed = Array.from(results.values()).filter(
      (r) => r.status !== "NOT_ASSESSED"
    ).length;
    return { assessed, total, percentage: total > 0 ? (assessed / total) * 100 : 0 };
  };

  const getSectionProgress = (section: string) => {
    const sectionItems = checklistItems.filter((i) => i.section === section);
    const assessed = sectionItems.filter((i) => {
      const result = results.get(i.ref);
      return result && result.status !== "NOT_ASSESSED";
    }).length;
    return { assessed, total: sectionItems.length };
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
        <Text style={styles.loadingText}>Loading checklists...</Text>
      </View>
    );
  }

  // Checklist Selection
  if (!selectedChecklist) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Checklist</Text>
        </View>

        <ScrollView style={styles.content}>
          {checklists.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No checklists available</Text>
              <Text style={styles.emptySubtitle}>
                Sync your device to download checklists
              </Text>
            </View>
          ) : (
            checklists.map((checklist) => (
              <TouchableOpacity
                key={checklist.id}
                style={styles.checklistCard}
                onPress={() => selectChecklist(checklist)}
              >
                <Text style={styles.checklistName}>{checklist.name}</Text>
                <Text style={styles.checklistVersion}>
                  Version {checklist.version}
                </Text>
                <Text style={styles.checklistArrow}>→</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  const progress = getProgress();
  const currentItems = getCurrentSectionItems();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedChecklist(null)}>
          <Text style={styles.backLink}>← Checklists</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedChecklist.name}</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress.percentage}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.assessed}/{progress.total} items assessed
          </Text>
        </View>
      </View>

      {/* Section Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionTabs}
        contentContainerStyle={styles.sectionTabsContent}
      >
        {sections.map((section) => {
          const sectionProgress = getSectionProgress(section);
          const isComplete = sectionProgress.assessed === sectionProgress.total;
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
          const result = results.get(item.ref) || { status: "NOT_ASSESSED", notes: "" };
          const isExpanded = expandedItem === item.ref;
          const statusOption = STATUS_OPTIONS.find((s) => s.value === result.status);

          return (
            <View key={item.ref} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemHeader}
                onPress={() => setExpandedItem(isExpanded ? null : item.ref)}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemRef}>{item.ref}</Text>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.item}
                  </Text>
                </View>
                {result.status !== "NOT_ASSESSED" && (
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
                        onPress={() => updateItemStatus(item.ref, option.value)}
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
                    onChangeText={(text) => updateItemNotes(item.ref, text)}
                    placeholder="Add assessment notes..."
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomBar}>
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
    color: "#2d5c8f",
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
    backgroundColor: "#2d5c8f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 20,
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
  },
  checklistCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  checklistName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  checklistVersion: {
    fontSize: 12,
    color: "#64748b",
    marginRight: 12,
  },
  checklistArrow: {
    fontSize: 18,
    color: "#94a3b8",
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
    backgroundColor: "#2d5c8f",
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
    paddingBottom: 100,
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
  itemRef: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2d5c8f",
    marginBottom: 2,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: "500",
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
