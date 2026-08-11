import { BusinessForm } from "@/components/dashboard/business-form";

export const metadata = { title: "New Business" };

export default function NewBusinessPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Create business</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Save a draft, publish when ready, or archive later from manage view.
      </p>
      <div className="mt-6">
        <BusinessForm mode="create" />
      </div>
    </div>
  );
}
