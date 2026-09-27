import { Pressable, StyleSheet, Text, View } from "react-native";

import { Palette, Radius, Spacing } from "@/constants/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
};

export function AppButton({ title, onPress, disabled, variant = "primary" }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.ghost,
        pressed && !disabled && (primary ? styles.primaryPressed : styles.ghostPressed),
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, primary ? styles.primaryLabel : styles.ghostLabel]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityLiveRegion="polite">
      <Text style={styles.errorTitle}>Hata</Text>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  primary: {
    backgroundColor: Palette.orange,
  },
  primaryPressed: {
    backgroundColor: Palette.orangePressed,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Palette.navySoft,
  },
  ghostPressed: {
    backgroundColor: Palette.navy,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  primaryLabel: {
    color: "#1A0D00",
  },
  ghostLabel: {
    color: Palette.text,
  },
  errorBox: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderColor: Palette.danger,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  errorTitle: {
    color: Palette.danger,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
  },
  errorText: {
    color: Palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
