import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Palette, Radius, Spacing } from "@/constants/theme";

type Props = {
  title: string;
  hint: string;
  uri?: string | null;
  tall?: boolean;
  onPress: () => void;
};

export function ImageDropCard({ title, hint, uri, tall, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.card, tall && styles.tall]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.action}>{uri ? "Değiştir" : "Yükle"}</Text>
      </View>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="contain" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderMark}>＋</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tall: {
    minHeight: 280,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  action: {
    color: Palette.orange,
    fontSize: 13,
    fontWeight: "600",
  },
  image: {
    width: "100%",
    height: 240,
    borderRadius: Radius.md,
    backgroundColor: Palette.bgElevated,
  },
  placeholder: {
    height: 180,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Palette.navySoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Palette.bgElevated,
  },
  placeholderMark: {
    color: Palette.orange,
    fontSize: 28,
    fontWeight: "300",
  },
  hint: {
    color: Palette.muted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
});
