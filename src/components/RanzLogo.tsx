/**
 * RANZ Logo Component
 * Reusable branded logo for use across the app
 */

import { Image, View, Text, StyleSheet, type ImageStyle, type ViewStyle } from "react-native";
import { COLORS } from "../lib/theme";

interface RanzLogoProps {
  /** Logo display size */
  size?: "small" | "medium" | "large";
  /** Show subtitle text below logo */
  showSubtitle?: boolean;
  /** Subtitle text (defaults to "Roofing Inspection") */
  subtitle?: string;
}

const SIZES = {
  small: { width: 40, height: 40 },
  medium: { width: 100, height: 100 },
  large: { width: 160, height: 160 },
} as const;

export function RanzLogo({ size = "medium", showSubtitle = false, subtitle = "Roofing Inspection" }: RanzLogoProps) {
  const dimensions = SIZES[size];

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/icon.png")}
        style={[styles.image, { width: dimensions.width, height: dimensions.height } as ImageStyle]}
        resizeMode="contain"
      />
      {showSubtitle && (
        <Text style={[styles.subtitle, size === "small" && styles.subtitleSmall]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  } as ViewStyle,
  image: {
    borderRadius: 12,
  } as ImageStyle,
  subtitle: {
    fontSize: 14,
    color: COLORS.gray[500],
    marginTop: 8,
    letterSpacing: 0.5,
  },
  subtitleSmall: {
    fontSize: 11,
    marginTop: 4,
  },
});
