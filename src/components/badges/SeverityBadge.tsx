/**
 * SeverityBadge Component
 * Displays defect severity with color-coded badge
 */

import { View, Text, StyleSheet } from "react-native";
import { DefectSeverity } from "../../types/shared";

const SEVERITY_COLORS: Record<DefectSeverity, string> = {
  [DefectSeverity.CRITICAL]: "#ef4444",
  [DefectSeverity.HIGH]: "#f97316",
  [DefectSeverity.MEDIUM]: "#3b82f6",
  [DefectSeverity.LOW]: "#22c55e",
};

const SEVERITY_LABELS: Record<DefectSeverity, string> = {
  [DefectSeverity.CRITICAL]: "Critical",
  [DefectSeverity.HIGH]: "High",
  [DefectSeverity.MEDIUM]: "Medium",
  [DefectSeverity.LOW]: "Low",
};

interface SeverityBadgeProps {
  severity: DefectSeverity | string;
  size?: "sm" | "md" | "lg";
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const color = SEVERITY_COLORS[severity as DefectSeverity] || "#6b7280";
  const label = SEVERITY_LABELS[severity as DefectSeverity] || severity;

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
