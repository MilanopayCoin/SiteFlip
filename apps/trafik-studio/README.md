# Trafik Studio

Expo SDK 57 + Expo Router uygulaması. Trafik teorisi görselini yükler, Fal.ai Flux img2img ile sahneyi yeniden üretir (yol düzeni, oklar ve araç açıları korunur).

## Çalıştırma

```bash
cd apps/trafik-studio
cp .env.example .env
# EXPO_PUBLIC_FAL_KEY değerini Fal.ai anahtarınızla doldurun
npm install
npx expo start
```

## Yapı

- `src/app` — Expo Router ekranları (ana ekran)
- `src/ai` — model-agnostik img2img sağlayıcıları (`providers/`)
- `src/components` — kartlar ve butonlar
- `src/config/env.ts` — `.env` okuma
