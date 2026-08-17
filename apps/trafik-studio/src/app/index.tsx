import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AiClientError,
  buildRecreatePrompt,
  getImageToImageProvider,
  type LocalImage,
} from "@/ai";
import { AppButton, ErrorBanner } from "@/components/app-button";
import { ImageDropCard } from "@/components/image-drop-card";
import { ResultCard } from "@/components/result-card";
import { Palette, Spacing } from "@/constants/theme";
import { getImageStrength } from "@/config/env";
import { useImagePicker } from "@/hooks/use-image-picker";
import { saveRemoteImage, shareRemoteImage } from "@/lib/share";

export default function HomeScreen() {
  const { pick, busy: picking } = useImagePicker();
  const [source, setSource] = useState<LocalImage | null>(null);
  const [logo, setLogo] = useState<LocalImage | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickSource() {
    setError(null);
    try {
      const image = await pick();
      if (image) {
        setSource(image);
        setResultUrl(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Görsel seçilemedi.");
    }
  }

  async function onPickLogo() {
    setError(null);
    try {
      const image = await pick();
      if (image) setLogo(image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo seçilemedi.");
    }
  }

  async function onRecreate() {
    if (!source) {
      setError("Önce orijinal trafik görselini yükleyin.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const provider = getImageToImageProvider();
      const result = await provider.recreate({
        source,
        logo,
        prompt: buildRecreatePrompt(Boolean(logo)),
        strength: getImageStrength(),
      });
      setResultUrl(result.imageUrl);
    } catch (e) {
      const message =
        e instanceof AiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Yeniden oluşturma başarısız.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onShare() {
    if (!resultUrl) return;
    setActionBusy(true);
    setError(null);
    try {
      await shareRemoteImage(resultUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paylaşılamadı.");
    } finally {
      setActionBusy(false);
    }
  }

  async function onDownload() {
    if (!resultUrl) return;
    setActionBusy(true);
    setError(null);
    try {
      const path = await saveRemoteImage(resultUrl);
      Alert.alert("İndirildi", "Görsel cihaza kaydedildi. Paylaşım ile Fotoğraflar’a da ekleyebilirsiniz.");
      void path;
    } catch (e) {
      setError(e instanceof Error ? e.message : "İndirme başarısız.");
    } finally {
      setActionBusy(false);
    }
  }

  const canRun = Boolean(source) && !loading && !picking;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text style={styles.kicker}>Trafik teorisi</Text>
            <Text style={styles.h1}>Senaryo Stüdyosu</Text>
            <Text style={styles.lead}>
              Kural, yol düzeni, ok yönleri ve araç açıları korunur. Stil ve çevre
              yenilenir.
            </Text>
          </View>

          <ImageDropCard
            tall
            title="Orijinal görsel"
            hint="Sürücü kursu / trafik teorisi sahnesini seçin"
            uri={source?.uri}
            onPress={onPickSource}
          />

          <ImageDropCard
            title="Logo (isteğe bağlı)"
            hint="Araçlara yerleştirilecek logo"
            uri={logo?.uri}
            onPress={onPickLogo}
          />

          <AppButton
            title={loading ? "Oluşturuluyor…" : "Senaryoyu Yeniden Oluştur"}
            onPress={onRecreate}
            disabled={!canRun}
          />

          <ErrorBanner message={error} />

          <ResultCard
            loading={loading}
            resultUrl={resultUrl}
            onDownload={onDownload}
            onShare={onShare}
            busyAction={actionBusy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  hero: {
    gap: 6,
    paddingTop: Spacing.sm,
  },
  kicker: {
    color: Palette.orange,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  h1: {
    color: Palette.text,
    fontSize: 28,
    fontWeight: "800",
  },
  lead: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
