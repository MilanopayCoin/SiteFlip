"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DATA = [
  { month: "Mar", revenue: 6200, profit: 4100, traffic: 98000 },
  { month: "Apr", revenue: 6800, profit: 4500, traffic: 105000 },
  { month: "May", revenue: 7100, profit: 4700, traffic: 112000 },
  { month: "Jun", revenue: 7800, profit: 5200, traffic: 118000 },
  { month: "Jul", revenue: 8200, profit: 5400, traffic: 125000 },
  { month: "Aug", revenue: 8600, profit: 5700, traffic: 131000 },
];

export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Analytics</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Portfolio revenue, profit, and traffic (demo aggregate).
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Revenue & profit</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DATA}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                fill="url(#rev)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#34d399"
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
