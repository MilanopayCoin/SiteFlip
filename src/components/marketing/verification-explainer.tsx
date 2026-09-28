import { SectionHeading } from "@/components/ui/section-heading";
import { VerifiedBadge } from "@/components/ui/verified-badge";

const CHECKS = [
  "Domain ownership (DNS / registrar evidence)",
  "Revenue source access (Stripe, Mollie, or analytics read-only)",
  "Code repository or asset handover path",
  "Traffic / usage data where applicable",
  "Seller identity alignment with the asset",
] as const;

export function VerificationExplainer() {
  return (
    <section className="jiy-section bg-surface-2">
      <div className="jiy-container grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Trust"
            title="How verification works"
            subtitle="What we check before a listing earns the badge — and what it guarantees."
          />
          <ul className="mt-8 space-y-3 text-sm text-muted">
            {CHECKS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent" aria-hidden>
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[12px] border border-border bg-surface p-8">
          <VerifiedBadge />
          <p className="mt-6 text-sm leading-relaxed text-muted">
            <strong className="text-foreground">The badge means</strong> JIY has
            verified at least one ownership or operations claim against evidence
            you can inspect on the listing. It is not a guarantee of future
            revenue, legal title in every jurisdiction, or investment performance.
          </p>
          <p className="mt-4 text-xs text-muted">
            TODO: Link to full verification policy page when published.
          </p>
        </div>
      </div>
    </section>
  );
}
