/**
 * Trafik Studio — koyu mavi + turuncu palet.
 * Uygulama her zaman dark tema kullanır.
 */
import { Platform } from "react-native";

export const Palette = {
  bg: "#07111F",
  bgElevated: "#0C1A2E",
  card: "#10233C",
  cardBorder: "rgba(255, 149, 58, 0.18)",
  navy: "#143A66",
  navySoft: "#1B4B82",
  orange: "#FF8A2B",
  orangePressed: "#E67316",
  text: "#F4F7FB",
  muted: "#93A4BB",
  danger: "#FF6B6B",
  success: "#3DDC97",
  overlay: "rgba(7, 17, 31, 0.72)",
} as const;

export const Spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
} as const;

export const Fonts = Platform.select({
  ios: { sans: "system-ui", mono: "ui-monospace" },
  default: { sans: "System", mono: "monospace" },
});
