import { ShieldCheck, Wallet, Handshake } from "lucide-react";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Ownership verified",
    body: "Listings stay private until JIY validates ownership evidence.",
  },
  {
    icon: Wallet,
    title: "Protected payments via Mollie",
    body: "Checkout is processor-backed; paid status follows the provider webhook.",
  },
  {
    icon: Handshake,
    title: "No payout before buyer approval",
    body: "Seller delivery and buyer acceptance gate payout eligibility.",
  },
] as const;

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="jiy-container grid gap-8 py-10 md:grid-cols-3 md:py-12">
        {ITEMS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface-2 text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
