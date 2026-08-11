"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FactoryRentPage() {
  const params = useParams<{ projectId: string }>();
  const [data, setData] = useState<{
    suggestedRentalRangeEurMonthly: { min: number; max: number };
    estimateNote: string;
    configurable: {
      monthlyRentalPrice: number;
      contractPeriodMonths: number;
      rentToOwn: { enabled: boolean; creditPercent: number; note: string };
    };
    listPath: string;
    assumptions: string[];
  } | null>(null);
  const [price, setPrice] = useState<number | "">("");
  const [months, setMonths] = useState(12);
  const [rto, setRto] = useState(false);
  const [credit, setCredit] = useState(40);

  async function calc() {
    const res = await fetch(`/api/factory/projects/${params.projectId}/rent`, {
      method: "POST",
    });
    const json = await res.json();
    setData(json);
    setPrice(json.configurable.monthlyRentalPrice);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/build/${params.projectId}`}>← Back</Link>
      </Button>
      <h1 className="mt-4 text-2xl font-semibold text-white">Rent my business</h1>
      <p className="mt-1 text-sm text-zinc-400">
        BUILD → RENT. Estimates only. No automatic legally binding contracts.
      </p>

      <Button className="mt-6" onClick={calc}>
        Calculate suggested rent
      </Button>

      {data && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suggested range (estimate)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-xl text-white">
                €{data.suggestedRentalRangeEurMonthly.min} – €
                {data.suggestedRentalRangeEurMonthly.max}/mo
              </p>
              <p className="mt-2 text-zinc-500">{data.estimateNote}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configure offer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Monthly rental price (€)</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Contract period (months)</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={rto}
                  onChange={(e) => setRto(e.target.checked)}
                />
                Enable rent-to-own (optional)
              </label>
              {rto && (
                <div>
                  <Label>Credit toward purchase (%)</Label>
                  <Input
                    type="number"
                    className="mt-1.5"
                    value={credit}
                    onChange={(e) => setCredit(Number(e.target.value))}
                  />
                </div>
              )}
              <p className="sm:col-span-2 text-xs text-zinc-600">
                {data.configurable.rentToOwn.note}
              </p>
            </CardContent>
          </Card>

          <ul className="list-disc pl-4 text-xs text-amber-200/80">
            {data.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>

          <Button asChild>
            <Link href={data.listPath}>Continue to Rent marketplace</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
