/**
 * Model-agnostik img2img sözleşmesi.
 * Yeni bir sağlayıcı eklemek için ImageToImageProvider implement edin
 * ve `src/ai/index.ts` içindeki registry’ye kaydedin.
 */

export type LocalImage = {
  uri: string;
  mimeType: string;
  /** Fal `image_url` için data URI (base64). */
  dataUri: string;
};

export type RecreateInput = {
  source: LocalImage;
  logo?: LocalImage | null;
  prompt: string;
  /** Fal img2img: başlangıç görselinin etkisi (uygulamada 0.78–0.88). */
  strength: number;
};

export type RecreateResult = {
  imageUrl: string;
  seed?: number;
  modelId: string;
};

export interface ImageToImageProvider {
  readonly id: string;
  readonly label: string;
  recreate(input: RecreateInput): Promise<RecreateResult>;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code:
      | "MISSING_API_KEY"
      | "MISSING_SOURCE"
      | "NETWORK"
      | "PROVIDER"
      | "EMPTY_RESULT" = "PROVIDER"
  ) {
    super(message);
    this.name = "AiClientError";
  }
}
