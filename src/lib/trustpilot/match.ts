export type TrustpilotMatch = {
  matched: boolean;
  profileUrl: string | null;
  trustScore: number | null;
  reviewCount: number | null;
  note: string;
};

function hostFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const u = new URL(
      website.startsWith("http") ? website : `https://${website}`
    );
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Build Trustpilot review URL from business website (no scraping). */
export function trustpilotUrlFromWebsite(
  website: string | null | undefined
): string | null {
  const host = hostFromWebsite(website);
  if (!host) return null;
  return `https://www.trustpilot.com/review/${host}`;
}

/**
 * Trustpilot Business API requires partnership. When TRUSTPILOT_API_KEY is set,
 * extend here; until then return a deep link for manual verification.
 */
export async function matchTrustpilot(input: {
  businessName: string;
  website: string | null;
  market: "tr" | "nl";
}): Promise<TrustpilotMatch> {
  const profileUrl = trustpilotUrlFromWebsite(input.website);
  const hasApi = Boolean(process.env.TRUSTPILOT_API_KEY?.trim());

  if (!profileUrl) {
    return {
      matched: false,
      profileUrl: null,
      trustScore: null,
      reviewCount: null,
      note:
        input.market === "tr"
          ? "Web sitesi yok — Trustpilot eşleşmesi atlandı."
          : "Geen website — Trustpilot-koppeling overgeslagen.",
    };
  }

  if (!hasApi) {
    return {
      matched: false,
      profileUrl,
      trustScore: null,
      reviewCount: null,
      note:
        input.market === "tr"
          ? "Trustpilot profil bağlantısı hazır (puan için API anahtarı gerekir)."
          : "Trustpilot-profiel klaar (score vereist API-sleutel).",
    };
  }

  // Placeholder for official Business Units API integration.
  return {
    matched: false,
    profileUrl,
    trustScore: null,
    reviewCount: null,
    note: "Trustpilot API configured — enrichment pending implementation.",
  };
}
