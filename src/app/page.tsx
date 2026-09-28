import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMarketplaceListings } from "@/lib/data/marketplace-data";
import { filterRealListings } from "@/lib/marketing/listing-filters";
import { listingTickerLabel } from "@/lib/marketing/ticker-label";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingTicker } from "@/components/marketing/landing-ticker";
import { HeroVerificationScene } from "@/components/marketing/hero-verification-scene";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { ModesBento } from "@/components/marketing/modes-bento";
import { ValuationCalculator } from "@/components/marketing/valuation-calculator";
import { HowItWorksSteps } from "@/components/marketing/how-it-works-steps";
import { ReviveSection } from "@/components/marketing/revive-section";
import { ListingCard } from "@/components/marketing/listing-card";
import { VerificationExplainer } from "@/components/marketing/verification-explainer";
import { LandingFaq } from "@/components/marketing/landing-faq";
import { LandingCtaFooter } from "@/components/marketing/landing-cta-footer";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { listings: raw } = await fetchMarketplaceListings(
    { sort: "newest" },
    { page: 1, pageSize: 48 }
  );
  const listings = filterRealListings(raw);

  const tickerLabels = listings.slice(0, 12).map(listingTickerLabel);
  const featured = listings.slice(0, 6);
  const revive = listings.filter((l) => l.listing_type === "REVIVE").slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <LandingTicker items={tickerLabels} />

      <section className="jiy-section relative overflow-hidden">
        <div className="sf-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="jiy-container relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="sf-label text-accent/90">
              The exchange for digital businesses
            </p>
            <h1 className="text-display mt-4 text-foreground">
              Buy, sell and rent verified digital businesses.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">
              Every listing is ownership-checked. Every payment is protected until
              delivery.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/marketplace">
                  Explore marketplace <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/sell">Sell your business</Link>
              </Button>
            </div>
          </div>
          <HeroVerificationScene />
        </div>
      </section>

      <TrustStrip />
      <ModesBento />
      <ValuationCalculator />
      <HowItWorksSteps />
      <ReviveSection listings={revive} />

      <section className="jiy-section border-t border-border">
        <div className="jiy-container">
          <SectionHeading
            eyebrow="Exchange floor"
            title="Featured listings"
            subtitle="Live listings with seller-submitted metrics. Verified badge when JIY confirms evidence."
          />
          {featured.length === 0 ? (
            <EmptyState
              title="First verified listings coming soon"
              description="We publish only real listings after ownership review — no placeholder inventory."
              actionHref="/sell"
              actionLabel="List your business"
            />
          ) : (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>
      </section>

      <VerificationExplainer />
      <LandingFaq />
      <LandingCtaFooter />
    </div>
  );
}
