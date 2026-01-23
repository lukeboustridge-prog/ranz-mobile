/**
 * Root Layout
 * App entry point with Clerk auth provider and navigation setup
 */

import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus, Text } from "react-native";
import * as SecureStore from "expo-secure-store";
import { initializeDatabase } from "../src/lib/sqlite";
import { startAutoSync, stopAutoSync } from "../src/services/sync-service";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { appLogger, authLogger } from "../src/lib/logger";

// Import background sync to register the task definition
// This must be imported at the top level so TaskManager.defineTask runs
import "../src/services/background-sync";
import { registerBackgroundSync, unregisterBackgroundSync } from "../src/services/background-sync";

// Clerk publishable key - should be in environment variables
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

// Token cache for Clerk using SecureStore
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      authLogger.exception("Error getting token from SecureStore", error);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      authLogger.exception("Error saving token to SecureStore", error);
    }
  },
};

/**
 * Auth Guard Component
 * Redirects users based on authentication state
 */
function AuthGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isSignedIn && inAuthGroup) {
      // Signed in user trying to access auth pages - redirect to main
      router.replace("/(main)/home");
    } else if (!isSignedIn && !inAuthGroup) {
      // Not signed in and trying to access protected pages - redirect to login
      router.replace("/(auth)/login");
    }
  }, [isLoaded, isSignedIn, segments]);

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
        await registerBackgroundSync();

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

  return <>{children}</>;
}

/**
 * Root Layout Component
 */
export default function RootLayout() {
  // Warn if Clerk key is missing
  if (!CLERK_PUBLISHABLE_KEY) {
    authLogger.warn("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable");
  }

  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <ClerkLoaded>
          <DatabaseProvider>
            <AuthGuard />
          </DatabaseProvider>
        </ClerkLoaded>
      </ClerkProvider>
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
