import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "My Offers" };

const DEMO_OFFERS = [
  {
    id: "off-1",
    listing: "AI Invoice SaaS",
    amount: 11000,
    status: "PENDING",
    type: "BUY",
  },
  {
    id: "off-2",
    listing: "TabFlow Extension",
    amount: 5800,
    status: "COUNTERED",
    type: "BUY",
  },
];

export default function MyOffersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">My Offers</h1>
      <p className="mt-1 text-sm text-zinc-400">
        States: PENDING · COUNTERED · ACCEPTED · REJECTED · EXPIRED · CANCELLED
      </p>
      <div className="mt-6 space-y-3">
        {DEMO_OFFERS.map((o) => (
          <Card key={o.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-white">{o.listing}</p>
                <p className="text-sm text-zinc-400">
                  €{o.amount.toLocaleString()} · {o.type}
                </p>
              </div>
              <Badge variant={o.status === "PENDING" ? "warning" : "info"}>
                {o.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Make Offer · Counter Offer · Accept · Reject · Cancel — wired via /api/offers.
          Persist with Supabase when configured.
        </CardContent>
      </Card>
    </div>
  );
}
