/**
 * ChipSelector Component
 * Horizontal scrollable chip selector for single selection
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";

export interface ChipOption {
  value: string;
  label: string;
  color?: string;
}

interface ChipSelectorProps {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function ChipSelector({
  label,
  options,
  value,
  onChange,
  required,
}: ChipSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipContainer}
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          const backgroundColor = isSelected
            ? option.color || "#2d5c8f"
            : "#f3f4f6";
          const textColor = isSelected ? "#ffffff" : "#374151";
          const borderColor = isSelected
            ? option.color || "#2d5c8f"
            : "#e5e7eb";

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.chip,
                { backgroundColor, borderColor },
              ]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: textColor }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  chipContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
});

export default ChipSelector;
