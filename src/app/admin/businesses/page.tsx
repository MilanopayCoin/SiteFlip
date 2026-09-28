import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Businesses" };

export default function AdminBusinessesPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Businesses</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin · Businesses</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Operational view for businesses. Connect Supabase service role + admin RLS
          (profiles.is_admin) to load live data. Demo mode shows architecture only.
        </CardContent>
      </Card>
    </div>
  );
}
