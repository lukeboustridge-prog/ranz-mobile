/**
 * ClassificationBadge Component
 * Displays defect classification with color-coded badge
 */

import { View, Text, StyleSheet } from "react-native";
import { DefectClass } from "../../types/shared";

const CLASSIFICATION_COLORS: Record<DefectClass, string> = {
  [DefectClass.MAJOR_DEFECT]: "#dc2626",
  [DefectClass.MINOR_DEFECT]: "#f59e0b",
  [DefectClass.SAFETY_HAZARD]: "#7c3aed",
  [DefectClass.MAINTENANCE_ITEM]: "#0891b2",
  [DefectClass.WORKMANSHIP_ISSUE]: "#ea580c",
};

const CLASSIFICATION_LABELS: Record<DefectClass, string> = {
  [DefectClass.MAJOR_DEFECT]: "Major Defect",
  [DefectClass.MINOR_DEFECT]: "Minor Defect",
  [DefectClass.SAFETY_HAZARD]: "Safety Hazard",
  [DefectClass.MAINTENANCE_ITEM]: "Maintenance",
  [DefectClass.WORKMANSHIP_ISSUE]: "Workmanship",
};

interface ClassificationBadgeProps {
  classification: DefectClass | string;
  size?: "sm" | "md" | "lg";
}

export function ClassificationBadge({ classification, size = "md" }: ClassificationBadgeProps) {
  const color = CLASSIFICATION_COLORS[classification as DefectClass] || "#6b7280";
  const label = CLASSIFICATION_LABELS[classification as DefectClass] || classification.replace(/_/g, " ");

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
