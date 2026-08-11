import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "My Rentals" };

export default function MyRentalsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">My Rentals</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Active rentals and rent-to-own contracts. Flexible architecture — not automatic legal escrow.
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>No active rentals</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          When you rent a business, monthly payment, contract period, purchase option, and
          remaining balance will appear here. Credit percent is seller-configurable.
        </CardContent>
      </Card>
    </div>
  );
}
