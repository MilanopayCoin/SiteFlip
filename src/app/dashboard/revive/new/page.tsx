import { BusinessForm } from "@/components/dashboard/business-form";

export const metadata = { title: "Submit Revive Project" };

export default function NewRevivePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Submit revive project</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Abandoned or underused digital projects. Seller claims are labeled separately
        from verified data and AI hypotheses.
      </p>
      <div className="mt-6">
        <BusinessForm mode="revive" />
      </div>
    </div>
  );
}
