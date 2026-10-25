"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Loader2, MapPin, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MENU_MARKETS,
  type MenuMarket,
} from "@/lib/places/markets";
import type { VenueMetadata } from "@/lib/qr-menu/types";

export type VenueSelection = {
  name: string;
  tagline: string;
  venue: VenueMetadata | null;
  manual: boolean;
};

type Props = {
  market: MenuMarket;
  name: string;
  onNameChange: (name: string) => void;
  onSelectionChange: (sel: VenueSelection) => void;
};

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export function VenuePlacePicker({
  market,
  name,
  onNameChange,
  onSelectionChange,
}: Props) {
  const listId = useId();
  const [sessionToken] = useState(() => nanoid(24));
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [preview, setPreview] = useState<{
    address?: string;
    rating?: number;
    reviewCount?: number;
    trustUrl?: string;
    trustNote?: string;
    photoUrl?: string;
  } | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = MENU_MARKETS[market].copy;

  const notifyManual = useCallback(
    (value: string) => {
      onSelectionChange({
        name: value,
        tagline: "",
        venue: null,
        manual: true,
      });
      setPreview(null);
    },
    [onSelectionChange]
  );

  useEffect(() => {
    notifyManual(name);
  }, [market]); // eslint-disable-line react-hooks/exhaustive-deps -- reset enrichment on market switch

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    const q = name.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          market,
          sessionToken,
        });
        const res = await fetch(`/api/places/autocomplete?${params}`);
        const data = await res.json();
        setConfigured(Boolean(data.configured));
        const list = (data.suggestions ?? []) as Suggestion[];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [name, market, sessionToken]);

  async function pickSuggestion(s: Suggestion) {
    setOpen(false);
    setEnriching(true);
    onNameChange(s.primaryText);
    try {
      const params = new URLSearchParams({
        placeId: s.placeId,
        market,
        sessionToken,
      });
      const res = await fetch(`/api/places/details?${params}`);
      if (!res.ok) {
        notifyManual(s.primaryText);
        return;
      }
      const data = await res.json();
      const tagline = (data.tagline as string) || "";
      const venue = data.venue as VenueMetadata;
      onSelectionChange({
        name: data.name as string,
        tagline,
        venue,
        manual: false,
      });
      setPreview({
        address: venue.formattedAddress,
        rating: venue.googleRating,
        reviewCount: venue.googleReviewCount,
        trustUrl: venue.trustpilotProfileUrl || undefined,
        trustNote: data.trustpilotNote as string,
        photoUrl: (data.photoUrl as string) || undefined,
      });
    } catch {
      notifyManual(s.primaryText);
    } finally {
      setEnriching(false);
    }
  }

  const showList = open && suggestions.length > 0 && !enriching;

  const helper = useMemo(() => {
    if (configured === false) return copy.poweredBy + " (API key missing — type name manually)";
    if (enriching) return market === "tr" ? "Mekan bilgileri yükleniyor…" : "Zaakgegevens laden…";
    return copy.poweredBy;
  }, [configured, enriching, copy.poweredBy, market]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="venue">{market === "tr" ? "Mekan adı" : "Zaaknaam"}</Label>
        <div className="relative">
          <Input
            id="venue"
            required
            minLength={2}
            value={name}
            onChange={(e) => {
              onNameChange(e.target.value);
              notifyManual(e.target.value);
            }}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            placeholder={copy.searchPlaceholder}
            className="h-12 text-base pr-10"
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
          />
          {(loading || enriching) && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
          )}
        </div>
        <p className="text-xs text-muted">{helper}</p>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="max-h-56 overflow-auto rounded-xl border border-border bg-surface shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.placeId} role="option">
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm hover:bg-surface-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
              >
                <span className="font-medium">{s.primaryText}</span>
                {s.secondaryText && (
                  <span className="text-xs text-muted">{s.secondaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="flex gap-3 rounded-xl border border-border bg-surface-2/80 p-3 text-sm">
          {preview.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.photoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 space-y-1">
            {preview.address && (
              <p className="flex items-start gap-1.5 text-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{preview.address}</span>
              </p>
            )}
            {preview.rating != null && (
              <p className="flex items-center gap-1 text-foreground">
                <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                Google {preview.rating.toFixed(1)}
                {preview.reviewCount != null && (
                  <span className="text-muted">({preview.reviewCount})</span>
                )}
              </p>
            )}
            {preview.trustUrl && (
              <a
                href={preview.trustUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent underline-offset-2 hover:underline"
              >
                Trustpilot
              </a>
            )}
            {preview.trustNote && (
              <p className="text-xs text-muted">{preview.trustNote}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
