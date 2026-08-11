import Link from "next/link";
import {
  DEMO_BUSINESSES,
  DEMO_SELLERS,
  getEnrichedListings,
} from "@/lib/data/demo";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  const listings = getEnrichedListings();
  const active = listings.filter((l) => l.status === "ACTIVE");

  const stats = [
    { label: "Users", value: DEMO_SELLERS.length, href: "/admin/users" },
    { label: "Businesses", value: DEMO_BUSINESSES.length, href: "/admin/businesses" },
    { label: "Listings", value: active.length, href: "/admin/listings" },
    { label: "Transactions", value: 0, href: "/admin/transactions" },
    { label: "Verifications", value: "DNS MVP", href: "/admin/verifications" },
    { label: "Disputes", value: 0, href: "/admin/disputes" },
    { label: "Reports", value: 0, href: "/admin/reports" },
    { label: "AI usage", value: "Metered", href: "/admin" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">Admin</h1>
      <p className="mt-2 text-zinc-400">
        Platform operations — users, listings, verification, disputes, AI usage,
        subscriptions. Demo data until Supabase + admin RLS roles are connected.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-violet-500/30">
              <CardContent className="p-5">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Platform revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            <p>Subscriptions · listing fees · success fees — Stripe integration pending.</p>
            <p className="mt-2 text-white">{formatCurrency(0)} MTD (demo)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security posture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge variant="success">RLS schema ready</Badge>
            <Badge variant="success">Zod validation</Badge>
            <Badge variant="success">Rate limit architecture</Badge>
            <Badge variant="warning">No fake verification</Badge>
            <Badge variant="info">Stripe ≠ escrow</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
