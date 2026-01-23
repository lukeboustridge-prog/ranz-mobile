/**
 * Admin Layout
 * Layout for admin-specific screens
 */

import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#dc2626",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Stack.Screen
        name="dashboard"
        options={{
          title: "Admin Dashboard",
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="users"
        options={{
          title: "User Management",
        }}
      />
      <Stack.Screen
        name="reports"
        options={{
          title: "All Reports",
        }}
      />
      <Stack.Screen
        name="audit-log"
        options={{
          title: "Audit Log",
        }}
      />
    </Stack>
  );
}
