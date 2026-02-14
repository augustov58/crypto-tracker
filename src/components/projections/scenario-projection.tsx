"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { mockPortfolioStats } from "@/lib/mock-data";

interface Scenario {
  name: string;
  multiplier: number;
  probability: number;
  color: string;
}

export function ScenarioProjection() {
  const [years, setYears] = useState(3);
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { name: "Bull", multiplier: 3.0, probability: 25, color: "#22c55e" },
    { name: "Base", multiplier: 1.5, probability: 50, color: "#3b82f6" },
    { name: "Bear", multiplier: 0.4, probability: 25, color: "#ef4444" },
  ]);

  const updateScenario = (index: number, field: keyof Scenario, value: number) => {
    const updated = [...scenarios];
    updated[index] = { ...updated[index], [field]: value };
    setScenarios(updated);
  };

  const projectionData = useMemo(() => {
    const currentValue = mockPortfolioStats.totalValue;
    const data = [];

    for (let month = 0; month <= years * 12; month++) {
      const progress = month / (years * 12);
      const point: Record<string, number | string> = {
        month,
        year: (month / 12).toFixed(1),
      };

      scenarios.forEach((scenario) => {
        const targetValue = currentValue * scenario.multiplier;
        point[scenario.name] = Math.round(currentValue + (targetValue - currentValue) * progress);
      });

      data.push(point);
    }

    return data;
  }, [years, scenarios]);

  const expectedValue = scenarios.reduce((sum, s) => {
    const finalValue = mockPortfolioStats.totalValue * s.multiplier;
    return sum + finalValue * (s.probability / 100);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Horizon (Years)</label>
            <Input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              min={1}
              max={10}
            />
          </div>

          {scenarios.map((scenario, index) => (
            <div key={scenario.name} className="space-y-2">
              <label className="text-sm font-medium" style={{ color: scenario.color }}>
                {scenario.name} Scenario
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={scenario.multiplier}
                  onChange={(e) => updateScenario(index, "multiplier", Number(e.target.value))}
                  placeholder="Multiplier"
                />
                <Input
                  type="number"
                  value={scenario.probability}
                  onChange={(e) => updateScenario(index, "probability", Number(e.target.value))}
                  placeholder="Prob %"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                ${(mockPortfolioStats.totalValue * scenario.multiplier).toLocaleString()} @ {scenario.probability}%
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-accent/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-xl font-bold">${mockPortfolioStats.totalValue.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-sm text-green-500">Bull Case</p>
            <p className="text-xl font-bold text-green-500">
              ${(mockPortfolioStats.totalValue * scenarios[0].multiplier).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-500">Base Case</p>
            <p className="text-xl font-bold text-blue-500">
              ${(mockPortfolioStats.totalValue * scenarios[1].multiplier).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-sm text-red-500">Bear Case</p>
            <p className="text-xl font-bold text-red-500">
              ${(mockPortfolioStats.totalValue * scenarios[2].multiplier).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="p-4 bg-primary/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Expected Value (Probability-Weighted)</p>
          <p className="text-2xl font-bold text-primary">${Math.round(expectedValue).toLocaleString()}</p>
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projectionData}>
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
                formatter={(value, name) => [`$${(value as number).toLocaleString()}`, name as string]}
              />
              <Legend />
              {scenarios.map((scenario) => (
                <Area
                  key={scenario.name}
                  type="monotone"
                  dataKey={scenario.name}
                  stroke={scenario.color}
                  fill={scenario.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
