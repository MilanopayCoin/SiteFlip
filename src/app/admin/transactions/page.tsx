import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Transactions" };

export default function AdminTransactionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Transactions</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin · Transactions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Operational view for transactions. Connect Supabase service role + admin RLS
          (profiles.is_admin) to load live data. Demo mode shows architecture only.
        </CardContent>
      </Card>
    </div>
  );
}
