/**
 * StatusBadge Component
 * Displays report status with color-coded badge
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ReportStatus } from "../../types/shared";

interface StatusBadgeProps {
  status: ReportStatus;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "#6b7280",
    bgColor: "#f3f4f6",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "#2563eb",
    bgColor: "#dbeafe",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    color: "#d97706",
    bgColor: "#fef3c7",
  },
  APPROVED: {
    label: "Approved",
    color: "#059669",
    bgColor: "#d1fae5",
  },
  FINALISED: {
    label: "Finalised",
    color: "#7c3aed",
    bgColor: "#ede9fe",
  },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;

  const sizeStyles = {
    sm: { paddingVertical: 2, paddingHorizontal: 6, fontSize: 10 },
    md: { paddingVertical: 4, paddingHorizontal: 10, fontSize: 12 },
    lg: { paddingVertical: 6, paddingHorizontal: 14, fontSize: 14 },
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          paddingVertical: sizeStyles[size].paddingVertical,
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: sizeStyles[size].fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
  },
});

export default StatusBadge;
