import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Businesses" };

export default function AdminBusinessesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Businesses</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin · Businesses</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Operational view for businesses. Connect Supabase service role + admin RLS
          (profiles.is_admin) to load live data. Demo mode shows architecture only.
        </CardContent>
      </Card>
    </div>
  );
}
