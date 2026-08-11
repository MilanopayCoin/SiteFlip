import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Messages</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Internal messaging without exposing personal email. Conversations link to
        listing, offer, business, transaction, or rental.
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-400">
          <div className="rounded-lg border border-white/10 p-3">
            <p className="font-medium text-zinc-200">Re: AI Invoice SaaS offer</p>
            <p className="mt-1">Would you consider €11,000 with a 7-day inspection?</p>
            <p className="mt-1 text-xs text-zinc-600">Linked to listing · offer</p>
          </div>
          <div className="rounded-lg border border-white/10 p-3">
            <p className="font-medium text-zinc-200">Rent inquiry — Wellness Store</p>
            <p className="mt-1">Interested in rent-to-own at 35% credit. Demo thread.</p>
            <p className="mt-1 text-xs text-zinc-600">Linked to listing · rental</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
