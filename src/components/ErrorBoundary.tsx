/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */

import React, { Component, type ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { appLogger } from "../lib/logger";
import { COLORS, SPACING, BORDER_RADIUS } from "../lib/theme";

// ============================================
// TYPES
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ============================================
// ERROR BOUNDARY CLASS
// ============================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log the error
    appLogger.exception("Unhandled error caught by ErrorBoundary", error, {
      componentStack: errorInfo.componentStack,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>!</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We encountered an unexpected error. Please try again or contact support if the problem persists.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              accessibilityHint="Attempts to reload the screen"
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Show error details */}
            {this.state.error && (
              <ScrollView style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Error Details (Development Only)</Text>
                <Text style={styles.detailsText}>{this.state.error.message}</Text>
                {this.state.error.stack && (
                  <Text style={styles.stackText}>{this.state.error.stack}</Text>
                )}
                {this.state.errorInfo?.componentStack && (
                  <>
                    <Text style={styles.detailsTitle}>Component Stack</Text>
                    <Text style={styles.stackText}>{this.state.errorInfo.componentStack}</Text>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// ============================================
// SCREEN ERROR BOUNDARY
// ============================================

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName?: string;
}

/**
 * Error boundary specifically for screen-level errors
 * Provides navigation option to go back
 */
export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ScreenErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    appLogger.exception(`Screen error: ${this.props.screenName || "Unknown"}`, error, {
      screenName: this.props.screenName,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.screenContainer}>
          <View style={styles.screenContent}>
            <Text style={styles.screenIcon}>!</Text>
            <Text style={styles.screenTitle}>Unable to load screen</Text>
            <Text style={styles.screenMessage}>
              {this.props.screenName
                ? `The ${this.props.screenName} screen encountered an error.`
                : "This screen encountered an error."}
            </Text>

            <TouchableOpacity
              style={styles.screenRetryButton}
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Reload screen"
            >
              <Text style={styles.screenRetryText}>Reload Screen</Text>
            </TouchableOpacity>

            {__DEV__ && this.state.error && (
              <View style={styles.devError}>
                <Text style={styles.devErrorText}>{this.state.error.message}</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  content: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING["3xl"],
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    fontSize: 48,
    fontWeight: "bold",
    color: COLORS.white,
    backgroundColor: "#dc2626",
    width: 80,
    height: 80,
    borderRadius: 40,
    textAlign: "center",
    lineHeight: 80,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: COLORS.gray[600],
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING["2xl"],
  },
  retryButton: {
    backgroundColor: COLORS.primary[500],
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING["2xl"],
    borderRadius: BORDER_RADIUS.md,
    minWidth: 120,
    minHeight: 48, // WCAG touch target
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  detailsContainer: {
    marginTop: SPACING.xl,
    maxHeight: 200,
    width: "100%",
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  detailsText: {
    fontSize: 12,
    color: "#dc2626",
    marginBottom: SPACING.sm,
  },
  stackText: {
    fontSize: 10,
    color: COLORS.gray[600],
    fontFamily: "monospace",
  },
  // Screen error boundary styles
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  screenContent: {
    alignItems: "center",
    maxWidth: 300,
  },
  screenIcon: {
    fontSize: 36,
    fontWeight: "bold",
    color: COLORS.white,
    backgroundColor: "#dc2626",
    width: 60,
    height: 60,
    borderRadius: 30,
    textAlign: "center",
    lineHeight: 60,
    marginBottom: SPACING.lg,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  screenMessage: {
    fontSize: 14,
    color: COLORS.gray[600],
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING["2xl"],
  },
  screenRetryButton: {
    backgroundColor: COLORS.primary[500],
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 48,
  },
  screenRetryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  devError: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: "#fee2e2",
    borderRadius: BORDER_RADIUS.sm,
  },
  devErrorText: {
    fontSize: 11,
    color: "#dc2626",
    fontFamily: "monospace",
  },
});

export default ErrorBoundary;
