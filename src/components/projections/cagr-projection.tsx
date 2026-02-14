"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";

export function CagrProjection() {
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [growthRate, setGrowthRate] = useState(20);
  const [years, setYears] = useState(5);
  const [monthlyDca, setMonthlyDca] = useState(500);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const response = await fetch("/api/portfolio");
        if (response.ok) {
          const data = await response.json();
          setCurrentValue(data.totalUsd || 0);
        }
      } catch {
        setCurrentValue(0);
      } finally {
        setLoading(false);
      }
    }
    fetchPortfolio();
  }, []);

  const projectionData = useMemo(() => {
    if (currentValue === null) return [];
    
    const monthlyRate = growthRate / 100 / 12;
    const data = [];

    let value = currentValue;
    for (let month = 0; month <= years * 12; month++) {
      data.push({
        month,
        year: month / 12,  // Keep as number for proper chart rendering
        value: Math.round(value),
        label: month % 12 === 0 ? `Year ${month / 12}` : "",
      });
      value = value * (1 + monthlyRate) + monthlyDca;
    }

    return data;
  }, [currentValue, growthRate, years, monthlyDca]);

  if (loading || currentValue === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CAGR Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const finalValue = projectionData[projectionData.length - 1]?.value || 0;
  const totalGain = finalValue - currentValue;
  const totalDca = monthlyDca * years * 12;

  return (
    <Card>
      <CardHeader>
        <CardTitle>CAGR Projection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Annual Growth Rate (%)</label>
            <Input
              type="number"
              value={growthRate}
              onChange={(e) => setGrowthRate(Number(e.target.value))}
              min={-50}
              max={200}
            />
            <input
              type="range"
              value={growthRate}
              onChange={(e) => setGrowthRate(Number(e.target.value))}
              min={-50}
              max={200}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Horizon (Years)</label>
            <Input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              min={1}
              max={20}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Monthly DCA ($)</label>
            <Input
              type="number"
              value={monthlyDca}
              onChange={(e) => setMonthlyDca(Number(e.target.value))}
              min={0}
              max={100000}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-accent/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-xl font-bold">${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="p-4 bg-accent/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Projected Value</p>
            <p className="text-xl font-bold text-green-500">${finalValue.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-accent/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Growth</p>
            <p className="text-xl font-bold text-green-500">+${totalGain.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-accent/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Total DCA</p>
            <p className="text-xl font-bold">${totalDca.toLocaleString()}</p>
          </div>
        </div>

        <div className="h-[300px] w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
            <ComposedChart data={projectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="year" 
                type="number"
                domain={[0, years]}
                stroke="#9ca3af"
                tickFormatter={(v) => Number.isInteger(v) ? `Y${v}` : ""}
                ticks={Array.from({ length: years + 1 }, (_, i) => i)}
              />
              <YAxis 
                stroke="#9ca3af"
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(value) => [`$${(value as number).toLocaleString()}`, "Value"]}
                labelFormatter={(label) => `Year ${Number(label).toFixed(1)}`}
              />
              <Area
                type="monotone"
                dataKey="value"
                fill="rgba(59, 130, 246, 0.2)"
                stroke="transparent"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
