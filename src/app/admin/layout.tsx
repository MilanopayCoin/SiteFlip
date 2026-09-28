import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="jiy-container flex max-w-6xl gap-8 py-8 sm:py-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <p className="sf-label mb-3">Operations</p>
        <AdminNav />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-6 lg:hidden">
          <AdminNav layout="pills" />
        </div>
        {children}
      </div>
    </div>
  );
}
