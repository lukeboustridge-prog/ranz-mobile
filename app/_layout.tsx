/**
 * Root Layout
 * App entry point with custom auth and navigation setup
 */

import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus, Text } from "react-native";
import { initializeDatabase } from "../src/lib/sqlite";
import { appLogger } from "../src/lib/logger";
import { useAuthStore } from "../src/stores/auth-store";

/**
 * Auth Guard Component
 * Redirects users based on authentication state
 */
function AuthGuard() {
  const { isAuthenticated, isLoading, biometricsEnabled, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [forceReady, setForceReady] = useState(false);

  // Initialize auth on mount with hard 5-second safety valve
  useEffect(() => {
    initialize();

    // Absolute safety valve: force loading to stop after 5 seconds no matter what
    const safety = setTimeout(() => {
      console.warn("[AuthGuard] Safety valve triggered — forcing ready state");
      setForceReady(true);
    }, 5_000);

    return () => clearTimeout(safety);
  }, []);

  // Auth routing logic
  useEffect(() => {
    if (isLoading && !forceReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inMainGroup = segments[0] === "(main)";

    if (isAuthenticated && !inMainGroup) {
      // Authenticated but not in main area (on index or auth pages) → go to home
      router.replace("/(main)/home");
    } else if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated and not on auth pages → go to login
      if (biometricsEnabled) {
        router.replace("/(auth)/biometric-unlock");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, isAuthenticated, segments, biometricsEnabled, forceReady]);

  if (isLoading && !forceReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3c4b5d" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return <Slot />;
}

/**
 * Database Initialization — blocks rendering until SQLite is ready
 * (with timeout safety net to prevent infinite spinner)
 */
function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    Promise.race([
      initializeDatabase(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 10_000)
      ),
    ])
      .then(() => {
        appLogger.info("Database initialized");
        setIsDbReady(true);
      })
      .catch((e) => {
        appLogger.error("Database init failed: " + (e as Error).message);
        // Still mark as ready so the app doesn't hang — screens will
        // degrade gracefully with empty data rather than infinite spinner
        setIsDbReady(true);
      });

    // Start auto-sync (bootstrap is triggered from home screen after auth is ready)
    import("../src/services/sync-service")
      .then(({ startAutoSync }) => {
        startAutoSync();
      })
      .catch(() => {});

    // Lazy-load background sync
    import("../src/services/background-sync")
      .then(({ registerBackgroundSync }) => registerBackgroundSync().catch(() => {}))
      .catch(() => {});

    return () => {
      import("../src/services/sync-service")
        .then(({ stopAutoSync }) => stopAutoSync())
        .catch(() => {});
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        import("../src/services/sync-service").then(({ startAutoSync }) => startAutoSync()).catch(() => {});
      } else if (state === "background") {
        import("../src/services/sync-service").then(({ stopAutoSync }) => stopAutoSync()).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3c4b5d" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Root Layout Component
 */
export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AuthGuard />
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
});
