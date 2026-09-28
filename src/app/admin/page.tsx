import Link from "next/link";
import { fetchMarketplaceStats } from "@/lib/marketplace/stats";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata = { title: "Admin" };

const SECTIONS = [
  { label: "Listings", href: "/admin/listings" },
  { label: "Verification", href: "/admin/verifications" },
  { label: "Deals & payments", href: "/admin/transactions" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Users", href: "/admin/users" },
  { label: "Audit log", href: "/admin/reports" },
];

export default async function AdminPage() {
  const stats = await fetchMarketplaceStats();

  return (
    <div>
      <SectionHeading
        eyebrow="Operations"
        title="Admin"
        subtitle="All actions require profiles.is_admin and are audited server-side."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Active listings" value={stats.activeListings} />
        <Stat label="Verified businesses" value={stats.verifiedBusinesses} />
        <Stat label="Completed deals" value={stats.completedDeals} />
      </div>

      <ul className="mt-10 grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="jiy-focus-ring block rounded-[12px] border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface px-4 py-5">
      <p className="font-mono text-2xl tabular font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
