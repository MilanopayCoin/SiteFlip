import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Verifications" };

export default function AdminVerificationsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Verifications</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin · Verifications</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Operational view for verifications. Connect Supabase service role + admin RLS
          (profiles.is_admin) to load live data. Demo mode shows architecture only.
        </CardContent>
      </Card>
    </div>
  );
}
