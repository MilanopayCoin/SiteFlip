import { ListingForm } from "@/components/dashboard/listing-form";

export const metadata = { title: "New Listing" };

export default function NewListingPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Create listing</h1>
      <p className="mt-1 text-sm text-zinc-400">
        BUY · RENT · RENT TO OWN · REVIVE · SELL — review before publishing.
      </p>
      <div className="mt-6">
        <ListingForm />
      </div>
    </div>
  );
}
