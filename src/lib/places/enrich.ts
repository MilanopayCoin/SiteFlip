import type { MenuMarket } from "@/lib/places/markets";
import { fetchPlaceDetails, type PlaceDetails } from "@/lib/places/google";
import { taglineFromPlaceType } from "@/lib/qr-menu/market-templates";
import type { VenueMetadata } from "@/lib/qr-menu/types";
import { matchTrustpilot } from "@/lib/trustpilot/match";
import { enrichTrustpilotByWebsite } from "@/lib/trustpilot/api";

export type EnrichedVenue = {
  name: string;
  tagline: string | null;
  venue: VenueMetadata;
  trustpilotNote: string;
};

export async function enrichFromGooglePlace(input: {
  placeId: string;
  market: MenuMarket;
  sessionToken: string;
}): Promise<{ ok: true; data: EnrichedVenue } | { ok: false; error: string }> {
  const details = await fetchPlaceDetails(input);
  if (!details?.name) {
    return { ok: false, error: "PLACE_NOT_FOUND" };
  }

  const trust = await matchTrustpilot({
    businessName: details.name,
    website: details.website,
    market: input.market,
  });
  const tpApi = await enrichTrustpilotByWebsite({
    businessName: details.name,
    website: details.website,
    market: input.market,
  });

  const venue = placeDetailsToVenue(details, input.market, {
    profileUrl: tpApi.profileUrl ?? trust.profileUrl,
    trustScore: tpApi.trustScore,
    reviewCount: tpApi.reviewCount,
  });

  return {
    ok: true,
    data: {
      name: details.name,
      tagline: taglineFromPlaceType(details.primaryType, input.market),
      venue,
      trustpilotNote: trust.note,
    },
  };
}

function placeDetailsToVenue(
  d: PlaceDetails,
  market: MenuMarket,
  trust: {
    profileUrl: string | null;
    trustScore: number | null;
    reviewCount: number | null;
  }
): VenueMetadata {
  return {
    market,
    googlePlaceId: d.placeId,
    formattedAddress: d.formattedAddress || undefined,
    lat: d.lat ?? undefined,
    lng: d.lng ?? undefined,
    phone: d.phone ?? undefined,
    website: d.website ?? undefined,
    googleRating: d.googleRating ?? undefined,
    googleReviewCount: d.googleReviewCount ?? undefined,
    trustpilotProfileUrl: trust.profileUrl ?? undefined,
    trustpilotScore: trust.trustScore ?? undefined,
    trustpilotReviewCount: trust.reviewCount ?? undefined,
    photoName: d.photoName ?? undefined,
    enrichedAt: new Date().toISOString(),
  };
}
