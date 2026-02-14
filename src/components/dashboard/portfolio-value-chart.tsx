"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioStore, TimeRange } from "@/lib/store";
import { SnapshotsResponse } from "@/app/api/snapshots/route";

const timeRanges: { value: TimeRange; label: string; days: number }[] = [
  { value: "24h", label: "24H", days: 1 },
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
  { value: "1y", label: "1Y", days: 365 },
  { value: "all", label: "All", days: 730 },
];

export function PortfolioValueChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { timeRange, setTimeRange } = usePortfolioStore();
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
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
        
        const interval = days > 14 ? 'daily' : 'hourly';
        
        const response = await fetch(
          `/api/snapshots?from=${from.toISOString()}&interval=${interval}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch snapshots");
        }

        const data: SnapshotsResponse = await response.json();
        
        setChartData(
          data.snapshots.map((s) => ({
            time: s.timestamp,
            value: s.totalUsd,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setChartData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshots();
  }, [timeRange]);

  // Render chart
  useEffect(() => {
    if (typeof window === "undefined" || !chartContainerRef.current || chartData.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;

    const initChart = async () => {
      const { createChart, ColorType } = await import("lightweight-charts");
      
      if (!chartContainerRef.current) return;

      chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#27272a" },
          horzLines: { color: "#27272a" },
        },
        width: chartContainerRef.current.clientWidth,
        height: 300,
        timeScale: {
          borderColor: "#27272a",
        },
        rightPriceScale: {
          borderColor: "#27272a",
        },
      });

      const areaSeries = chart.addAreaSeries({
        topColor: "rgba(59, 130, 246, 0.4)",
        bottomColor: "rgba(59, 130, 246, 0.0)",
        lineColor: "#3b82f6",
        lineWidth: 2,
      });

      // Use Unix timestamps for intraday data
      const formattedData = chartData.map((d) => ({
        time: Math.floor(new Date(d.time).getTime() / 1000) as unknown as `${number}-${number}-${number}`,
        value: d.value,
      }));

      areaSeries.setData(formattedData);
      chart.timeScale().fitContent();
    };

    initChart();

    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, [chartData]);

  return (
    <Card data-testid="portfolio-chart">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Portfolio Value</CardTitle>
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <Button
              key={range.value}
              variant={timeRange === range.value ? "default" : "ghost"}
              size="sm"
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
            No historical data yet. Snapshots will appear after the first cron run.
          </div>
        ) : (
          <div ref={chartContainerRef} style={{ width: '100%', height: 300 }} />
        )}
      </CardContent>
    </Card>
  );
}
