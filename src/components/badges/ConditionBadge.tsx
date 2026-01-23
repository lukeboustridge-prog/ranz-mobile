/**
 * ConditionBadge Component
 * Displays roof element condition with color-coded badge
 */

import { View, Text, StyleSheet } from "react-native";
import { ConditionRating } from "../../types/shared";

const CONDITION_COLORS: Record<ConditionRating, string> = {
  [ConditionRating.GOOD]: "#22c55e",
  [ConditionRating.FAIR]: "#eab308",
  [ConditionRating.POOR]: "#f97316",
  [ConditionRating.CRITICAL]: "#ef4444",
  [ConditionRating.NOT_INSPECTED]: "#6b7280",
};

const CONDITION_LABELS: Record<ConditionRating, string> = {
  [ConditionRating.GOOD]: "Good",
  [ConditionRating.FAIR]: "Fair",
  [ConditionRating.POOR]: "Poor",
  [ConditionRating.CRITICAL]: "Critical",
  [ConditionRating.NOT_INSPECTED]: "Not Inspected",
};

interface ConditionBadgeProps {
  condition: ConditionRating | string;
  size?: "sm" | "md" | "lg";
}

export function ConditionBadge({ condition, size = "md" }: ConditionBadgeProps) {
  const color = CONDITION_COLORS[condition as ConditionRating] || "#6b7280";
  const label = CONDITION_LABELS[condition as ConditionRating] || condition.replace(/_/g, " ");

  const sizeStyles = {
    sm: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 9 },
    md: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 10 },
    lg: { paddingHorizontal: 10, paddingVertical: 5, fontSize: 12 },
  };

  return (
    <View style={[styles.badge, { backgroundColor: color }, sizeStyles[size]]}>
      <Text style={[styles.text, { fontSize: sizeStyles[size].fontSize }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  text: {
    color: "#ffffff",
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
