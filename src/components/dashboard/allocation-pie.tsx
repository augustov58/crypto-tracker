"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PortfolioResponse, PortfolioToken } from "@/app/api/portfolio/route";

const COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#6366f1", // indigo
];

interface PieData {
  name: string;
  value: number;
  percentage: string;
  color: string;
}

export function AllocationPie() {
  const [data, setData] = useState<PieData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllocation() {
      try {
        const response = await fetch("/api/portfolio");
        if (!response.ok) {
          throw new Error("Failed to fetch portfolio");
        }

        const portfolio: PortfolioResponse = await response.json();
        const totalValue = portfolio.totalUsd;

        if (totalValue === 0 || portfolio.tokens.length === 0) {
          setData([]);
          return;
        }

        // Sort tokens by value and take top 8, group rest as "Other"
        const sortedTokens = [...portfolio.tokens].sort(
          (a, b) => (b.usdValue || 0) - (a.usdValue || 0)
        );

        const topTokens = sortedTokens.slice(0, 7);
        const otherTokens = sortedTokens.slice(7);
        const otherValue = otherTokens.reduce((sum, t) => sum + (t.usdValue || 0), 0);

        const pieData: PieData[] = topTokens.map((token, index) => ({
          name: token.symbol,
          value: token.usdValue || 0,
          percentage: (((token.usdValue || 0) / totalValue) * 100).toFixed(1),
          color: COLORS[index % COLORS.length],
        }));

        if (otherValue > 0) {
          pieData.push({
            name: "Other",
            value: otherValue,
            percentage: ((otherValue / totalValue) * 100).toFixed(1),
            color: COLORS[7],
          });
        }

        setData(pieData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchAllocation();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No assets to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(value) => [`$${(value as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Value"]}
              />
              <Legend
                formatter={(value, entry) => (
                  <span className="text-sm text-muted-foreground">
                    {value} ({(entry.payload as PieData)?.percentage}%)
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
