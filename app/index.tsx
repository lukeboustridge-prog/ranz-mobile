/**
 * Index Route
 * Shows a loading state while AuthGuard in _layout.tsx handles routing
 */

import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
  // AuthGuard in _layout.tsx handles all auth-based routing.
  // This screen is only briefly visible during the initial redirect.
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2d5c8f" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
