/**
 * OfflineIndicator Component
 * Shows a banner when the app is offline
 *
 * Positioned as an absolute banner that slides down from below the header.
 * Uses animation for smooth appear/disappear transitions.
 * Provides reassurance that data is saved locally.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

const BANNER_HEIGHT = 56;

export function OfflineIndicator() {
  const { isConnected } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? -BANNER_HEIGHT : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected, slideAnim]);

  // Always render but animate position - avoids layout shift
  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel="No connection. Changes saved locally."
    >
      <Text style={styles.icon}>&#9729;</Text>
      <View style={styles.textContainer}>
        <Text style={styles.text}>No connection</Text>
        <Text style={styles.subtext}>Changes saved locally</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    backgroundColor: "#fef2f2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    zIndex: 100,
  },
  icon: {
    fontSize: 20,
    color: "#dc2626",
  },
  textContainer: {
    alignItems: "flex-start",
  },
  text: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
  subtext: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 1,
  },
});

export default OfflineIndicator;
