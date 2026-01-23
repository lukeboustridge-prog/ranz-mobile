/**
 * Review Layout
 * Layout for reviewer-specific screens
 */

import { Stack } from "expo-router";

export default function ReviewLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#7c3aed",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Stack.Screen
        name="queue"
        options={{
          title: "Review Queue",
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="report/[id]"
        options={{
          title: "Review Report",
        }}
      />
    </Stack>
  );
}
