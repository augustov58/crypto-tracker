"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";
import { mockPortfolioStats } from "@/lib/mock-data";

export function CagrProjection() {
  const [growthRate, setGrowthRate] = useState(20);
  const [years, setYears] = useState(5);
  const [monthlyDca, setMonthlyDca] = useState(500);

  const projectionData = useMemo(() => {
    const currentValue = mockPortfolioStats.totalValue;
    const monthlyRate = growthRate / 100 / 12;
    const data = [];

    let value = currentValue;
    for (let month = 0; month <= years * 12; month++) {
      data.push({
        month,
        year: (month / 12).toFixed(1),
        value: Math.round(value),
        label: month % 12 === 0 ? `Year ${month / 12}` : "",
      });
      value = value * (1 + monthlyRate) + monthlyDca;
    }

    return data;
  }, [growthRate, years, monthlyDca]);

  const finalValue = projectionData[projectionData.length - 1]?.value || 0;
  const totalGain = finalValue - mockPortfolioStats.totalValue;
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
            <p className="text-xl font-bold">${mockPortfolioStats.totalValue.toLocaleString()}</p>
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

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={projectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="year" 
                stroke="#9ca3af"
                tickFormatter={(v) => v % 1 === 0 ? `Y${v}` : ""}
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
              />
              <Area
                type="monotone"
                dataKey="value"
                fill="rgba(59, 130, 246, 0.2)"
                stroke="transparent"
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
