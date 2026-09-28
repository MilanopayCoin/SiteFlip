import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="jiy-container flex max-w-7xl gap-8 py-8 sm:py-10">
      <DashboardNav />
      <div className="min-w-0 flex-1">
        <DashboardNav mobile />
        {children}
      </div>
    </div>
  );
}
