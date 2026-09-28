import Link from "next/link";
import type { Listing } from "@/types/database";
import { SectionHeading } from "@/components/ui/section-heading";
import { ListingCard } from "@/components/marketing/listing-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function ReviveSection({ listings }: { listings: Listing[] }) {
  return (
    <section id="revive" className="jiy-section scroll-mt-24 border-t border-border">
      <div className="jiy-container">
        <SectionHeading
          eyebrow="Revive"
          title="Abandoned projects. Second lives."
          subtitle="Founders list paused or neglected assets — operators bring them back."
        />
        {listings.length === 0 ? (
          <EmptyState
            title="No Revive listings yet"
            description="Have an abandoned project? List it as Revive so the next operator can find it."
            actionHref="/sell"
            actionLabel="List abandoned project"
          />
        ) : (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} desaturated />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" asChild>
                <Link href="/marketplace?type=REVIVE">View all Revive</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
