/**
 * SyncToast Component
 * Toast notifications for sync events (success, error, conflicts)
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";

export type ToastType = "success" | "error" | "warning" | "info" | "conflict";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface SyncToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export function SyncToast({ toast, onDismiss }: SyncToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const getColors = () => {
    switch (toast.type) {
      case "success":
        return { bg: "#dcfce7", border: "#22c55e", icon: "✓", iconBg: "#22c55e" };
      case "error":
        return { bg: "#fef2f2", border: "#ef4444", icon: "!", iconBg: "#ef4444" };
      case "warning":
        return { bg: "#fffbeb", border: "#f59e0b", icon: "⚠", iconBg: "#f59e0b" };
      case "conflict":
        return { bg: "#fef3c7", border: "#d97706", icon: "⇆", iconBg: "#d97706" };
      case "info":
      default:
        return { bg: "#eff6ff", border: "#3b82f6", icon: "i", iconBg: "#3b82f6" };
    }
  };

  const colors = getColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={dismiss}
        activeOpacity={0.9}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
          <Text style={styles.icon}>{colors.icon}</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{toast.title}</Text>
          {toast.message && (
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
          )}
        </View>

        {toast.action && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => {
              toast.action?.onPress();
              dismiss();
            }}
          >
            <Text style={[styles.actionText, { color: colors.border }]}>
              {toast.action.label}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={dismiss}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Toast Container - Manages multiple toasts
 */
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <View style={styles.containerWrapper} pointerEvents="box-none">
      {toasts.map((toast, index) => (
        <View
          key={toast.id}
          style={[styles.toastWrapper, { top: index * 80 }]}
          pointerEvents="box-none"
        >
          <SyncToast toast={toast} onDismiss={onDismiss} />
        </View>
      ))}
    </View>
  );
}

/**
 * Hook for managing toasts
 */
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = (toast: Omit<ToastMessage, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAll = () => {
    setToasts([]);
  };

  // Convenience methods
  const success = (title: string, message?: string) =>
    showToast({ type: "success", title, message });

  const error = (title: string, message?: string) =>
    showToast({ type: "error", title, message, duration: 6000 });

  const warning = (title: string, message?: string) =>
    showToast({ type: "warning", title, message });

  const info = (title: string, message?: string) =>
    showToast({ type: "info", title, message });

  const conflict = (conflictCount: number, action?: ToastMessage["action"]) =>
    showToast({
      type: "conflict",
      title: `${conflictCount} Conflict${conflictCount > 1 ? "s" : ""} Resolved`,
      message: "Server version was used. Your changes may have been overwritten.",
      duration: 8000,
      action,
    });

  return {
    toasts,
    showToast,
    dismissToast,
    clearAll,
    success,
    error,
    warning,
    info,
    conflict,
  };
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  containerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    paddingTop: 50, // Account for status bar
  },
  toastWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  container: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  message: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    color: "#9ca3af",
    fontWeight: "300",
  },
});

export default SyncToast;
