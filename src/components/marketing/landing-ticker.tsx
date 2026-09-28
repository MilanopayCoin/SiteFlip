import { Marquee, MarqueeItem } from "@/components/ui/marquee";
import { TICKER_FALLBACK_ITEMS } from "@/lib/marketing/ticker-label";

export function LandingTicker({ items }: { items: string[] }) {
  const useLive = items.length >= 3;

  return (
    <Marquee duration={55} ariaLabel="Marketplace ticker">
      {useLive ? (
        items.map((label) => <MarqueeItem key={label}>{label}</MarqueeItem>)
      ) : (
        TICKER_FALLBACK_ITEMS.map((label) => (
          <MarqueeItem key={label}>{label}</MarqueeItem>
        ))
      )}
    </Marquee>
  );
}
