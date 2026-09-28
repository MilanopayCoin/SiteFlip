import Link from "next/link";
import { fetchMarketplaceStats } from "@/lib/marketplace/stats";

export const metadata = { title: "Admin" };

const SECTIONS = [
  { label: "Listings", href: "/admin/listings" },
  { label: "Verification", href: "/admin/verifications" },
  { label: "Deals", href: "/admin/transactions" },
  { label: "Payments", href: "/admin/transactions" },
  { label: "Payouts", href: "/admin/transactions" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Users", href: "/admin/users" },
  { label: "Audit Log", href: "/admin/reports" },
];

export default async function AdminPage() {
  const stats = await fetchMarketplaceStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold text-zinc-900">Admin</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Operations only. All actions require profiles.is_admin and are audited
        server-side.
      </p>

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
              className="block border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:border-zinc-400"
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
    <div className="border border-zinc-200 bg-white px-4 py-5">
      <p className="text-2xl font-semibold tabular-nums text-zinc-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
