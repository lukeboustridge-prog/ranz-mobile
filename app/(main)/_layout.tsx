/**
 * Main Layout
 * Layout for authenticated screens
 */

import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f8fafc" },
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="new-report" />
      <Stack.Screen name="report-detail/[id]" />
      <Stack.Screen name="photo-capture" />
      <Stack.Screen name="compliance-assessment" />
      <Stack.Screen name="defects/index" />
      <Stack.Screen name="defects/new" />
      <Stack.Screen name="defects/[id]" />
      <Stack.Screen name="elements/index" />
      <Stack.Screen name="elements/new" />
      <Stack.Screen name="elements/[id]" />
    </Stack>
  );
}
