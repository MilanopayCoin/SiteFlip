import Link from "next/link";
import { memoryStore } from "@/lib/data/memory-store";
import { DEMO_BUSINESSES, getEnrichedListings } from "@/lib/data/demo";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabaseMode = isSupabaseConfigured();
  type DashBiz = {
    id: string;
    name: string;
    lifecycle: string;
    asking_price: number | null;
    monthly_revenue: number | null;
    monthly_profit: number | null;
    ai_score: number | null;
    is_demo?: boolean;
  };

  let owned: DashBiz[] = memoryStore.listBusinessesForOwner("demo-user");
  let listings = memoryStore.listListingsForSeller("demo-user") as { id: string }[];
  let offers = memoryStore.listOffersForUser("demo-user");
  let watch = memoryStore.listWatch("demo-user");
  let rentals = memoryStore.listRentalRequests("demo-user");
  let unread = memoryStore.unreadCount("demo-user");
  let modeLabel = "DEMO";

  if (supabaseMode) {
    const supabase = await createClient();
    const { data: auth } = await supabase!.auth.getUser();
    if (auth.user) {
      modeLabel = "LIVE";
      const uid = auth.user.id;
      const [b, l, o, w, r] = await Promise.all([
        supabase!.from("businesses").select("*").eq("current_owner_id", uid),
        supabase!.from("listings").select("*").eq("seller_id", uid),
        supabase!
          .from("offers")
          .select("*")
          .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
        supabase!.from("watchlists").select("id").eq("user_id", uid),
        supabase!
          .from("rental_requests")
          .select("*")
          .or(`requester_id.eq.${uid},owner_id.eq.${uid}`),
      ]);
      owned = (b.data as DashBiz[]) ?? [];
      listings = (l.data as { id: string }[]) ?? [];
      offers = (o.data as typeof offers) ?? [];
      watch = (w.data as typeof watch) ?? [];
      rentals = (r.data as typeof rentals) ?? [];
    } else {
      owned = [];
      listings = [];
    }
  } else if (owned.length === 0) {
    // Show demo seller portfolio as illustration when user has no created businesses
    owned = DEMO_BUSINESSES.filter((b) => b.current_owner_id === "seller-1").map(
      (b) => ({ ...b, is_demo: true })
    );
    listings = getEnrichedListings()
      .filter((l) => l.seller_id === "seller-1")
      .map((l) => ({ id: l.id, is_demo: true }));
  }

  const forSale = owned.filter((b) =>
    ["FOR_SALE", "FOR_RENT"].includes(b.lifecycle)
  );
  const portfolioValue = owned.reduce((s, b) => s + (b.asking_price ?? 0), 0);
  const mrr = owned.reduce((s, b) => s + (b.monthly_revenue ?? 0), 0);
  const profit = owned.reduce((s, b) => s + (b.monthly_profit ?? 0), 0);
  const avgScore =
    owned.reduce((s, b) => s + (b.ai_score ?? 0), 0) / Math.max(owned.length, 1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            {modeLabel === "LIVE"
              ? "Live portfolio from your SITEFLIP account."
              : "DEMO mode — create businesses/listings locally, or connect Supabase Auth."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={modeLabel === "LIVE" ? "success" : "warning"}>
            {modeLabel}
          </Badge>
          <Button asChild>
            <Link href="/dashboard/ai">AI Command Center</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Portfolio value" value={formatCurrency(portfolioValue)} />
        <Stat title="Businesses owned" value={String(owned.length)} />
        <Stat title="For sale / rent" value={String(forSale.length)} />
        <Stat title="Monthly revenue" value={formatCurrency(mrr)} />
        <Stat title="Monthly profit" value={formatCurrency(profit)} />
        <Stat title="Avg AI score" value={avgScore ? avgScore.toFixed(0) : "—"} />
        <Stat title="Active listings" value={String(listings.length)} />
        <Stat
          title="Offers / Watch / Rentals"
          value={`${offers.length} / ${watch.length} / ${rentals.length}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/dashboard/businesses/new">Create business</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/dashboard/listings/new">Create listing</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/messages">
                Messages{unread > 0 ? ` (${unread})` : ""}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/offers">Offers</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/build">Business Factory</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {owned.length === 0 ? (
              <p className="text-zinc-400">
                Create a business to get AI recommendations based on your data.
              </p>
            ) : (
              <>
                <p className="text-zinc-300">
                  Review asking prices vs monthly profit for your portfolio.
                </p>
                <p className="text-zinc-300">
                  Consider listing growing assets or renting declining ones.
                </p>
              </>
            )}
            <p className="text-xs text-zinc-600">
              Recommendations use stored metrics only — no fabricated numbers.
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/dashboard/ai">Ask AI</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My businesses snapshot</CardTitle>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/dashboard/businesses">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {owned.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No businesses yet.{" "}
              <Link href="/dashboard/businesses/new" className="text-violet-300">
                Create one
              </Link>
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-3 pr-4">Business</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Value</th>
                  <th className="pb-3 pr-4">MRR</th>
                  <th className="pb-3">AI Score</th>
                </tr>
              </thead>
              <tbody>
                {owned.slice(0, 8).map((b) => (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="py-3 pr-4 font-medium text-white">
                      {b.name}
                      {b.is_demo ? (
                        <Badge variant="warning" className="ml-2">
                          DEMO
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{b.lifecycle}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">
                      {formatCurrency(b.asking_price)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">
                      {formatCurrency(b.monthly_revenue)}
                    </td>
                    <td className="py-3 text-zinc-300">{b.ai_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-zinc-500">{title}</p>
        <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}
