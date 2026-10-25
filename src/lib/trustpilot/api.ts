import type { MenuMarket } from "@/lib/places/markets";

export type TrustpilotEnrichment = {
  trustScore: number | null;
  reviewCount: number | null;
  profileUrl: string | null;
  displayName: string | null;
};

function apiKey(): string | null {
  return process.env.TRUSTPILOT_API_KEY?.trim() || null;
}

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

/**
 * Trustpilot Business Units API (requires API key + approved use).
 * @see https://developers.trustpilot.com/
 */
export async function enrichTrustpilotByWebsite(input: {
  website: string | null;
  businessName: string;
  market: MenuMarket;
}): Promise<TrustpilotEnrichment> {
  const domain = hostFromWebsite(input.website);
  const profileUrl = domain ? `https://www.trustpilot.com/review/${domain}` : null;
  const key = apiKey();

  if (!key || !domain) {
    return {
      trustScore: null,
      reviewCount: null,
      profileUrl,
      displayName: null,
    };
  }

  const params = new URLSearchParams({ name: input.businessName });
  const findUrl = `https://api.trustpilot.com/v1/business-units/find?${params.toString()}`;

  try {
    const res = await fetch(findUrl, {
      headers: {
        apikey: key,
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return {
        trustScore: null,
        reviewCount: null,
        profileUrl,
        displayName: null,
      };
    }
    const data = (await res.json()) as {
      id?: string;
      displayName?: string;
      score?: { trustScore?: number };
      numberOfReviews?: { total?: number };
      websiteUrl?: string;
    };

    const foundHost = hostFromWebsite(data.websiteUrl ?? null);
    if (foundHost && foundHost !== domain) {
      return {
        trustScore: null,
        reviewCount: null,
        profileUrl,
        displayName: data.displayName ?? null,
      };
    }

    const id = data.id;
    const resolvedProfile = id
      ? `https://www.trustpilot.com/review/${domain}`
      : profileUrl;

    return {
      trustScore:
        typeof data.score?.trustScore === "number" ? data.score.trustScore : null,
      reviewCount:
        typeof data.numberOfReviews?.total === "number"
          ? data.numberOfReviews.total
          : null,
      profileUrl: resolvedProfile,
      displayName: data.displayName ?? null,
    };
  } catch {
    return {
      trustScore: null,
      reviewCount: null,
      profileUrl,
      displayName: null,
    };
  }
}
