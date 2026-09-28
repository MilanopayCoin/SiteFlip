import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Reports" };

export default function AdminReportsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Reports</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin · Reports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Operational view for reports. Connect Supabase service role + admin RLS
          (profiles.is_admin) to load live data. Demo mode shows architecture only.
        </CardContent>
      </Card>
    </div>
  );
}
