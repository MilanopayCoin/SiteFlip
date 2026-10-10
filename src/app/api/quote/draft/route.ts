import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import {
  quoteDraftInputSchema,
  publicQuoteView,
} from "@/lib/quote/types";
import { saveQuoteDraft } from "@/lib/quote/store";

export const runtime = "nodejs";

/**
 * Create or update a quote draft. No auth required (guest checkout).
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();

  const parsed = quoteDraftInputSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    const order = await saveQuoteDraft(parsed.data);
    return jsonOk({
      quote: publicQuoteView(order),
      notice:
        "Draft saved. Pay €1 via Mollie to unlock the PDF download. Not escrow.",
    });
  } catch (err) {
    console.error("quote draft failed", err);
    return jsonError("Failed to save quote draft", 500);
  }
}
