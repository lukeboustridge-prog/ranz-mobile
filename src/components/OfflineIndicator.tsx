/**
 * OfflineIndicator Component
 * Shows a banner when the app is offline
 */

import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export function OfflineIndicator() {
  const { isConnected, type } = useNetworkStatus();

  if (isConnected) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <Text style={styles.text}>No internet connection</Text>
      <Text style={styles.subtext}>Changes will sync when online</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fef2f2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  text: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
  subtext: {
    color: "#f87171",
    fontSize: 11,
  },
});

export default OfflineIndicator;
