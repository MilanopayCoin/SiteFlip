import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Transactions" };

export default function AdminTransactionsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Transactions</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin · Transactions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Operational view for transactions. Connect Supabase service role + admin RLS
          (profiles.is_admin) to load live data. Demo mode shows architecture only.
        </CardContent>
      </Card>
    </div>
  );
}
