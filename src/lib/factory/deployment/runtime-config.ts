/**
 * BusinessRuntimeConfig — public config only for generated apps.
 * Never inject JIY.APP production secrets.
 */

import type { BusinessRuntimeConfig } from "./types";
import { BRAND } from "@/lib/brand";

const FORBIDDEN_KEYS = [
  "GROQ_API_KEY",
  "MOLLIE_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "OPENAI_API_KEY",
] as const;

export function createBusinessRuntimeConfig(input: {
  appName: string;
  businessId: string;
  version: string;
  publicUrl: string;
}): BusinessRuntimeConfig {
  return {
    PUBLIC_APP_NAME: input.appName,
    PUBLIC_APP_URL: input.publicUrl,
    BUSINESS_ID: input.businessId,
    APP_VERSION: input.version,
    label: "AI GENERATED STARTER",
  };
}

export function assertNoSecretsInConfig(config: Record<string, unknown>): void {
  for (const key of FORBIDDEN_KEYS) {
    if (key in config) {
      throw new Error(
        `Forbidden: ${key} must never be passed to generated applications`
      );
    }
  }
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "string" && /sk_live|service_role|api[_-]?key/i.test(v)) {
      throw new Error(`Forbidden secret-like value for key ${k}`);
    }
  }
}

export function previewSubdomainUrl(slug: string): string {
  return `https://${slug}.preview.${BRAND.domain}`;
}

export function productionSubdomainUrl(slug: string): string {
  return `https://${slug}.${BRAND.domain}`;
}
