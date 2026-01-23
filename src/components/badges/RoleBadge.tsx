/**
 * RoleBadge Component
 * Displays user role with color-coded badge
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { UserRole } from "../../types/shared";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md" | "lg";
}

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; color: string; bgColor: string }
> = {
  INSPECTOR: {
    label: "Inspector",
    color: "#2d5c8f",
    bgColor: "#dbeafe",
  },
  REVIEWER: {
    label: "Reviewer",
    color: "#7c3aed",
    bgColor: "#ede9fe",
  },
  ADMIN: {
    label: "Admin",
    color: "#dc2626",
    bgColor: "#fee2e2",
  },
};

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.INSPECTOR;

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

export default RoleBadge;
