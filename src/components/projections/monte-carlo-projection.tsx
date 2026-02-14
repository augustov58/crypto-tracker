"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";

export function MonteCarloProjection() {
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(365);
  const [simulations, setSimulations] = useState(1000);
  const [volatility, setVolatility] = useState(60);
  const [drift, setDrift] = useState(15);
  const [seed, setSeed] = useState(Date.now());

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

  const { projectionData, percentiles } = useMemo(() => {
    if (currentValue === null) {
      return { projectionData: [], percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 } };
    }

    const dailyVolatility = volatility / 100 / Math.sqrt(365);
    const dailyDrift = drift / 100 / 365;
    
    // Run simulations
    const allPaths: number[][] = [];
    for (let sim = 0; sim < simulations; sim++) {
      const path = [currentValue];
      let value = currentValue;
      
      for (let day = 1; day <= days; day++) {
        // Geometric Brownian Motion
        const randomReturn = (Math.random() - 0.5) * 2 * dailyVolatility + dailyDrift;
        value = value * (1 + randomReturn);
        path.push(value);
      }
      allPaths.push(path);
    }

    // Calculate percentiles at each day
    const data = [];
    for (let day = 0; day <= days; day += Math.max(1, Math.floor(days / 100))) {
      const dayValues = allPaths.map((path) => path[day]).sort((a, b) => a - b);
      const p10 = dayValues[Math.floor(simulations * 0.1)];
      const p25 = dayValues[Math.floor(simulations * 0.25)];
      const p50 = dayValues[Math.floor(simulations * 0.5)];
      const p75 = dayValues[Math.floor(simulations * 0.75)];
      const p90 = dayValues[Math.floor(simulations * 0.9)];

      data.push({
        day,
        p10: Math.round(p10),
        p25: Math.round(p25),
        p50: Math.round(p50),
        p75: Math.round(p75),
        p90: Math.round(p90),
      });
    }

    const finalValues = allPaths.map((path) => path[path.length - 1]).sort((a, b) => a - b);
    
    return {
      projectionData: data,
      percentiles: {
        p10: Math.round(finalValues[Math.floor(simulations * 0.1)]),
        p25: Math.round(finalValues[Math.floor(simulations * 0.25)]),
        p50: Math.round(finalValues[Math.floor(simulations * 0.5)]),
        p75: Math.round(finalValues[Math.floor(simulations * 0.75)]),
        p90: Math.round(finalValues[Math.floor(simulations * 0.9)]),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue, days, simulations, volatility, drift, seed]);

  if (loading || currentValue === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="fan-chart">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monte Carlo Simulation</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setSeed(Date.now())}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Resimulate
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Days to Simulate</label>
            <Input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              min={30}
              max={1825}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Simulations</label>
            <Input
              type="number"
              value={simulations}
              onChange={(e) => setSimulations(Number(e.target.value))}
              min={100}
              max={5000}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Annual Volatility (%)</label>
            <Input
              type="number"
              value={volatility}
              onChange={(e) => setVolatility(Number(e.target.value))}
              min={10}
              max={200}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Annual Drift (%)</label>
            <Input
              type="number"
              value={drift}
              onChange={(e) => setDrift(Number(e.target.value))}
              min={-50}
              max={100}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-sm text-red-500">P10 (Pessimistic)</p>
            <p className="text-xl font-bold text-red-500">${percentiles.p10.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-sm text-orange-500">P25</p>
            <p className="text-xl font-bold text-orange-500">${percentiles.p25.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-500">P50 (Median)</p>
            <p className="text-xl font-bold text-blue-500">${percentiles.p50.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <p className="text-sm text-cyan-500">P75</p>
            <p className="text-xl font-bold text-cyan-500">${percentiles.p75.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-sm text-green-500">P90 (Optimistic)</p>
            <p className="text-xl font-bold text-green-500">${percentiles.p90.toLocaleString()}</p>
          </div>
        </div>

        <div className="h-[300px] w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
            <AreaChart data={projectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="day" 
                stroke="#9ca3af"
                tickFormatter={(v) => `D${v}`}
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
              <Area
                type="monotone"
                dataKey="p90"
                stroke="transparent"
                fill="#22c55e"
                fillOpacity={0.1}
              />
              <Area
                type="monotone"
                dataKey="p75"
                stroke="transparent"
                fill="#06b6d4"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="p50"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="#3b82f6"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="p25"
                stroke="transparent"
                fill="#f97316"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="p10"
                stroke="transparent"
                fill="#ef4444"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Based on {simulations.toLocaleString()} simulations using Geometric Brownian Motion
        </p>
      </CardContent>
    </Card>
  );
}
