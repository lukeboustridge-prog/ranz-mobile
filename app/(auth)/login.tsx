/**
 * Login Screen
 * Custom JWT authentication login using RANZ auth system
 */

import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, useRouter } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { useAuthStore } from "../../src/stores/auth-store";
import { RanzLogo } from "../../src/components/RanzLogo";
import { COLORS } from "../../src/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const loginWithEmailPassword = useAuthStore((state) => state.loginWithEmailPassword);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    // Validate inputs
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Check network connectivity first
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setError("No internet connection. Please connect and try again.");
        setIsLoading(false);
        return;
      }

      // Call custom auth login - uses loginWithEmailPassword which calls API internally
      const result = await loginWithEmailPassword(email.trim().toLowerCase(), password);

      if (result.success) {
        // Check if user must change password (first login)
        if (result.mustChangePassword) {
          // TODO: Navigate to change password screen when implemented
          // For now, allow login and show warning
          console.log("[Login] User must change password on first login");
        }
        router.replace("/(main)/home");
      } else {
        setError(result.error || "Invalid email or password. Please try again.");
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Branded Header */}
        <View style={styles.brandHeader}>
          <RanzLogo size="large" />
          <Text style={styles.brandSubtitle}>Roofing Inspection</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Sign In</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="inspector@example.com"
              placeholderTextColor={COLORS.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.gray[400]}
              secureTextEntry
              autoComplete="password"
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{isLoading ? "Signing In..." : "Sign In"}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary[500],
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  brandHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 32,
  },
  brandSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    marginTop: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  form: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 32,
    flex: 1,
    minHeight: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.gray[900],
    marginBottom: 20,
  },
  error: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray[700],
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.gray[800],
  },
  button: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: COLORS.gray[400],
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  footerText: {
    color: COLORS.gray[500],
    fontSize: 14,
  },
  link: {
    color: COLORS.primary[500],
    fontSize: 14,
    fontWeight: "600",
  },
});
