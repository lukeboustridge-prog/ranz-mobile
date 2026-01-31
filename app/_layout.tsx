/**
 * Root Layout
 * App entry point with custom auth and navigation setup
 */

import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus, Text } from "react-native";
import { initializeDatabase } from "../src/lib/sqlite";
import { startAutoSync, stopAutoSync } from "../src/services/sync-service";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { SyncProvider } from "../src/contexts/SyncContext";
import { appLogger, authLogger } from "../src/lib/logger";
import { useAuthStore } from "../src/stores/auth-store";
import { useAuthDeepLink } from "../src/lib/auth/deep-linking";
import { canUseBiometrics } from "../src/lib/auth/biometrics";

// Import background sync to register the task definition
// This must be imported at the top level so TaskManager.defineTask runs
import "../src/services/background-sync";
import { registerBackgroundSync, unregisterBackgroundSync } from "../src/services/background-sync";

/**
 * Auth Guard Component
 * Redirects users based on authentication state
 */
function AuthGuard() {
  const { isAuthenticated, isLoading, biometricsEnabled, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, []);

  // Handle deep links for SSO callbacks
  useAuthDeepLink();

  // Auth routing logic
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isAuthenticated && inAuthGroup) {
      // Authenticated user in auth pages - go to main
      router.replace("/(main)/home");
    } else if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated and trying to access protected pages
      // Check if biometrics enabled for quick unlock
      if (biometricsEnabled) {
        router.replace("/(auth)/biometric-unlock");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, isAuthenticated, segments, biometricsEnabled]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2d5c8f" />
      </View>
    );
  }

  return <Slot />;
}

/**
 * Database Initialization Component
 * Also handles sync initialization and background task registration
 */
function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    async function initDb() {
      try {
        await initializeDatabase();
        setIsDbReady(true);

        // Register background sync task after DB is ready
        const registered = await registerBackgroundSync();
        if (registered) {
          appLogger.info("Background sync registered successfully");
        } else {
          appLogger.warn("Background sync registration failed or not available");
        }

        // Start foreground auto-sync when app is active
        startAutoSync();
      } catch (error) {
        appLogger.exception("Failed to initialize database", error);
        setDbError(error instanceof Error ? error : new Error("Database init failed"));
      }
    }
    initDb();

    // Cleanup on unmount
    return () => {
      stopAutoSync();
    };
  }, []);

  // Handle app state changes for foreground/background sync management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // App came to foreground - start auto-sync
        appLogger.debug("Foreground - starting auto-sync");
        startAutoSync();
      } else if (nextAppState === "background") {
        // App went to background - stop foreground sync (background task handles it)
        appLogger.debug("Background - stopping foreground auto-sync");
        stopAutoSync();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  if (dbError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Database Error</Text>
        <Text style={styles.errorMessage}>
          Unable to initialize the database. Please restart the app.
        </Text>
        {__DEV__ && (
          <Text style={styles.errorDetails}>{dbError.message}</Text>
        )}
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2d5c8f" />
      </View>
    );
  }

  return <SyncProvider>{children}</SyncProvider>;
}

/**
 * Root Layout Component
 */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <DatabaseProvider>
        <AuthGuard />
      </DatabaseProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
  },
  errorIcon: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
    backgroundColor: "#dc2626",
    width: 60,
    height: 60,
    borderRadius: 30,
    textAlign: "center",
    lineHeight: 60,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  errorDetails: {
    fontSize: 11,
    color: "#dc2626",
    marginTop: 16,
    fontFamily: "monospace",
  },
});
