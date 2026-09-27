import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { AppButton } from "@/components/app-button";
import { Palette, Radius, Spacing } from "@/constants/theme";

type Props = {
  loading: boolean;
  resultUrl: string | null;
  onDownload: () => void;
  onShare: () => void;
  busyAction?: boolean;
};

export function ResultCard({
  loading,
  resultUrl,
  onDownload,
  onShare,
  busyAction,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sonuç</Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Palette.orange} />
          <Text style={styles.loadingText}>Senaryo yeniden oluşturuluyor…</Text>
          <Text style={styles.hint}>Yol düzeni ve araç açıları korunuyor.</Text>
        </View>
      ) : resultUrl ? (
        <>
          <Image source={{ uri: resultUrl }} style={styles.image} contentFit="contain" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppButton
                title="İndir"
                variant="ghost"
                onPress={onDownload}
                disabled={busyAction}
              />
            </View>
            <View style={styles.flex}>
              <AppButton title="Paylaş" onPress={onShare} disabled={busyAction} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.hint}>
            Orijinal görseli yükleyip “Senaryoyu Yeniden Oluştur”a basın.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.cardBorder,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  title: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  image: {
    width: "100%",
    height: 280,
    borderRadius: Radius.md,
    backgroundColor: Palette.bgElevated,
  },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  loadingText: {
    color: Palette.text,
    fontWeight: "600",
  },
  hint: {
    color: Palette.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  empty: {
    minHeight: 88,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
