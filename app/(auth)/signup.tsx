/**
 * Signup Screen
 * Placeholder — accounts are provisioned by RANZ administrators
 */

import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { RanzLogo } from "../../src/components/RanzLogo";
import { COLORS } from "../../src/lib/theme";

export default function SignupScreen() {
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Branded Header */}
        <View style={styles.brandHeader}>
          <RanzLogo size="large" />
          <Text style={styles.brandSubtitle}>Roofing Inspection</Text>
        </View>

        {/* Content */}
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
    minHeight: 300,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.gray[900],
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.gray[500],
    lineHeight: 22,
    marginBottom: 16,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary[500],
    textAlign: "center",
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
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
