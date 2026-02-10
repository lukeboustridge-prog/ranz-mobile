/**
 * Signup Screen
 * Placeholder — accounts are provisioned by RANZ administrators
 */

import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";

export default function SignupScreen() {
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>RANZ</Text>
          <Text style={styles.subtitle}>Roofing Inspection</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Request Access</Text>
          <Text style={styles.description}>
            Inspector accounts are provisioned by RANZ administrators. Please contact your RANZ representative to request access to the mobile inspection app.
          </Text>
          <Text style={styles.email}>support@ranz.org.nz</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#2d5c8f",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 4,
  },
  form: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 22,
    marginBottom: 16,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2d5c8f",
    textAlign: "center",
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  link: {
    color: "#2d5c8f",
    fontSize: 14,
    fontWeight: "600",
  },
});
