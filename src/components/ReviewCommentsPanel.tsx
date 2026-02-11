/**
 * ReviewCommentsPanel Component (Mobile)
 * Displays reviewer feedback/comments for a report
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { api } from "../lib/api";

// Types
interface ReviewComment {
  id: string;
  reportId: string;
  reviewerId: string;
  comment: string;
  severity: "CRITICAL" | "ISSUE" | "NOTE" | "SUGGESTION";
  defectId: string | null;
  roofElementId: string | null;
  photoId: string | null;
  section: string | null;
  resolved: boolean;
  revisionRound: number;
  createdAt: string;
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
}

interface CommentsSummary {
  total: number;
  resolved: number;
  unresolved: number;
  bySeverity: {
    CRITICAL: number;
    ISSUE: number;
    NOTE: number;
    SUGGESTION: number;
  };
}

interface ReviewCommentsPanelProps {
  reportId: string;
  canResolve?: boolean;
  onCommentResolved?: (commentId: string) => void;
}

// Severity configuration
const SEVERITY_CONFIG = {
  CRITICAL: {
    label: "Critical",
    icon: "!!",
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  ISSUE: {
    label: "Issue",
    icon: "!",
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  NOTE: {
    label: "Note",
    icon: "i",
    color: "#2563eb",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  SUGGESTION: {
    label: "Suggestion",
    icon: "*",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    borderColor: "#ddd6fe",
  },
};

export function ReviewCommentsPanel({
  reportId,
  canResolve = false,
  onCommentResolved,
}: ReviewCommentsPanelProps) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [summary, setSummary] = useState<CommentsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeverities, setExpandedSeverities] = useState<string[]>([
    "CRITICAL",
    "ISSUE",
  ]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const response = await api.get(`/reports/${reportId}/comments`);
      setComments(response.data.comments || []);
      setSummary(response.data.summary || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    }
  }, [reportId]);

  useEffect(() => {
    setIsLoading(true);
    fetchComments().finally(() => setIsLoading(false));
  }, [fetchComments]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchComments();
    setIsRefreshing(false);
  };

  // Toggle severity section
  const toggleSeverity = (severity: string) => {
    setExpandedSeverities((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  // Mark comment as resolved
  const handleResolve = async (commentId: string, resolved: boolean) => {
    try {
      await api.patch(`/reports/${reportId}/comments/${commentId}/resolve`, {
        resolved,
      });

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved } : c))
      );

      if (onCommentResolved) {
        onCommentResolved(commentId);
      }
    } catch (err) {
      console.error("Failed to resolve comment:", err);
    }
  };

  // Group comments by severity
  const groupedComments = {
    CRITICAL: comments.filter((c) => c.severity === "CRITICAL"),
    ISSUE: comments.filter((c) => c.severity === "ISSUE"),
    NOTE: comments.filter((c) => c.severity === "NOTE"),
    SUGGESTION: comments.filter((c) => c.severity === "SUGGESTION"),
  };

  // Get target label
  const getTargetLabel = (comment: ReviewComment): string | null => {
    if (comment.defectId) return "Defect";
    if (comment.roofElementId) return "Element";
    if (comment.photoId) return "Photo";
    if (comment.section) return comment.section;
    return null;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3c4b5d" />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchComments}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Review Comments</Text>
        {summary && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{summary.total}</Text>
          </View>
        )}
      </View>

      {/* Summary Stats */}
      {summary && summary.total > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.stat, styles.statResolved]}>
            <Text style={styles.statText}>{summary.resolved} resolved</Text>
          </View>
          <View style={[styles.stat, styles.statPending]}>
            <Text style={styles.statText}>{summary.unresolved} pending</Text>
          </View>
        </View>
      )}

      {/* Comments List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {comments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No review comments yet</Text>
          </View>
        ) : (
          (["CRITICAL", "ISSUE", "NOTE", "SUGGESTION"] as const).map(
            (severity) => {
              const severityComments = groupedComments[severity];
              if (severityComments.length === 0) return null;

              const config = SEVERITY_CONFIG[severity];
              const isExpanded = expandedSeverities.includes(severity);

              return (
                <View key={severity} style={styles.severitySection}>
                  <TouchableOpacity
                    style={[
                      styles.severityHeader,
                      { backgroundColor: config.bgColor },
                    ]}
                    onPress={() => toggleSeverity(severity)}
                  >
                    <View style={styles.severityHeaderLeft}>
                      <View
                        style={[
                          styles.severityIcon,
                          { backgroundColor: config.color },
                        ]}
                      >
                        <Text style={styles.severityIconText}>
                          {config.icon}
                        </Text>
                      </View>
                      <Text
                        style={[styles.severityLabel, { color: config.color }]}
                      >
                        {config.label}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {severityComments.length}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.expandIcon}>
                      {isExpanded ? "−" : "+"}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.commentsContainer}>
                      {severityComments.map((comment) => {
                        const targetLabel = getTargetLabel(comment);

                        return (
                          <View
                            key={comment.id}
                            style={[
                              styles.commentCard,
                              {
                                backgroundColor: config.bgColor,
                                borderColor: config.borderColor,
                              },
                              comment.resolved && styles.commentResolved,
                            ]}
                          >
                            {/* Tags */}
                            <View style={styles.tagsRow}>
                              {targetLabel && (
                                <View style={styles.tag}>
                                  <Text style={styles.tagText}>
                                    {targetLabel}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.tag}>
                                <Text style={styles.tagText}>
                                  Round {comment.revisionRound}
                                </Text>
                              </View>
                              {comment.resolved && (
                                <View
                                  style={[styles.tag, styles.tagResolved]}
                                >
                                  <Text style={styles.tagResolvedText}>
                                    Resolved
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Comment Text */}
                            <Text
                              style={[
                                styles.commentText,
                                comment.resolved && styles.commentTextResolved,
                              ]}
                            >
                              {comment.comment}
                            </Text>

                            {/* Meta and Actions */}
                            <View style={styles.commentFooter}>
                              <Text style={styles.metaText}>
                                {comment.reviewer.name} -{" "}
                                {formatDate(comment.createdAt)}
                              </Text>

                              {canResolve && (
                                <TouchableOpacity
                                  style={[
                                    styles.resolveButton,
                                    comment.resolved &&
                                      styles.resolveButtonActive,
                                  ]}
                                  onPress={() =>
                                    handleResolve(comment.id, !comment.resolved)
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.resolveButtonText,
                                      comment.resolved &&
                                        styles.resolveButtonTextActive,
                                    ]}
                                  >
                                    {comment.resolved
                                      ? "Addressed"
                                      : "Mark Addressed"}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            }
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stat: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statResolved: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  statPending: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  statText: {
    fontSize: 12,
    color: "#374151",
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  severitySection: {
    marginBottom: 8,
  },
  severityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  severityHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  severityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  severityIconText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  severityLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  expandIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6b7280",
  },
  commentsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  commentCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  commentResolved: {
    opacity: 0.6,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: "#374151",
  },
  tagResolved: {
    backgroundColor: "#dcfce7",
  },
  tagResolvedText: {
    fontSize: 11,
    color: "#16a34a",
    fontWeight: "500",
  },
  commentText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
  },
  commentTextResolved: {
    textDecorationLine: "line-through",
    color: "#6b7280",
  },
  commentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  metaText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  resolveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
  },
  resolveButtonActive: {
    backgroundColor: "#dcfce7",
  },
  resolveButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  resolveButtonTextActive: {
    color: "#16a34a",
  },
});

export default ReviewCommentsPanel;
