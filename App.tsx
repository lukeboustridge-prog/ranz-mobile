import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { ensureStorageDirectories, logStoragePaths } from "./src/lib/file-storage";
import { initializeDatabase } from "./src/lib/sqlite";

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize database first (needed for logging)
        console.log("[App] Initializing database...");
        await initializeDatabase();
        console.log("[App] Database initialized");

        // Initialize evidence storage directories
        console.log("[App] Initializing evidence storage directories...");
        await ensureStorageDirectories();
        console.log("[App] Evidence storage directories initialized");

        // Log storage paths for debugging (development only)
        if (__DEV__) {
          logStoragePaths();
        }

        setIsInitializing(false);
      } catch (error) {
        console.error("[App] Initialization failed:", error);
        setInitError(error instanceof Error ? error.message : "Unknown initialization error");
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2d5c8f" />
        <Text style={styles.loadingText}>Initializing...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorDetail}>{initError}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
