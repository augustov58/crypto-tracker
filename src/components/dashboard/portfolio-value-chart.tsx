"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioStore, TimeRange } from "@/lib/store";
import { SnapshotsResponse } from "@/app/api/snapshots/route";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const timeRanges: { value: TimeRange; label: string; days: number }[] = [
  { value: "24h", label: "24H", days: 1 },
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
  { value: "1y", label: "1Y", days: 365 },
  { value: "all", label: "All", days: 730 },
];

interface ChartDataPoint {
  date: string;
  displayDate: string;
  value: number;
}

export function PortfolioValueChart() {
  const { timeRange, setTimeRange } = usePortfolioStore();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API
  useEffect(() => {
    async function fetchSnapshots() {
      setLoading(true);
      setError(null);

      try {
        const range = timeRanges.find((r) => r.value === timeRange);
        const days = range?.days || 7;

        const from = new Date();
        from.setDate(from.getDate() - days);

        const interval = days > 14 ? "daily" : "hourly";

        const response = await fetch(
          `/api/snapshots?from=${from.toISOString()}&interval=${interval}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch snapshots");
        }

        const data: SnapshotsResponse = await response.json();

        // Transform data for Recharts
        const transformed = data.snapshots.map((s) => {
          const date = new Date(s.timestamp);
          return {
            date: s.timestamp,
            displayDate:
              interval === "hourly"
                ? date.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                  })
                : date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  }),
            value: s.totalUsd,
          };
        });

        setChartData(transformed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setChartData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshots();
  }, [timeRange]);

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatTooltip = (value: number) => {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Calculate change percentage
  const change =
    chartData.length >= 2
      ? ((chartData[chartData.length - 1].value - chartData[0].value) /
          chartData[0].value) *
        100
      : null;

  return (
    <Card data-testid="portfolio-chart">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle>Portfolio Value</CardTitle>
          {chartData.length > 0 && (
            <div className="mt-1">
              <span className="text-2xl font-bold">
                $
                {chartData[chartData.length - 1].value.toLocaleString(
                  undefined,
                  { maximumFractionDigits: 0 }
                )}
              </span>
              {change !== null && (
                <span
                  className={`ml-2 text-sm ${change >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {timeRanges.map((range) => (
            <Button
              key={range.value}
              variant={timeRange === range.value ? "default" : "ghost"}
              size="sm"
              className="px-2 sm:px-3 text-xs sm:text-sm"
              onClick={() => setTimeRange(range.value)}
              data-testid={`range-${range.value}`}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full h-[300px]" />
        ) : error ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No historical data yet. Snapshots will appear after the first cron
            run.
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground flex-col gap-2">
            <p>Need more data points to show chart.</p>
            <p className="text-sm">
              Current value: $
              {chartData[chartData.length - 1]?.value.toLocaleString() || "N/A"}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(value) => [formatTooltip(value as number), "Value"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
