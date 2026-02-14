"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Coins, PiggyBank, BarChart3 } from "lucide-react";
import { PortfolioResponse } from "@/app/api/portfolio/route";

interface Stats {
  totalValue: number;
  change24h: number;
  change24hPercent: number;
  defiValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  tokenCount: number;
  walletCount: number;
}

export function QuickStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [portfolioRes, walletsRes] = await Promise.all([
          fetch("/api/portfolio"),
          fetch("/api/wallets"),
        ]);

        if (!portfolioRes.ok || !walletsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const portfolio: PortfolioResponse = await portfolioRes.json();
        const { wallets } = await walletsRes.json();

        // Calculate total PnL from tokens with cost basis
        let totalPnl = 0;
        let totalCostValue = 0;
        for (const token of portfolio.tokens) {
          if (token.unrealizedPnl !== undefined && token.costBasis !== undefined) {
            totalPnl += token.unrealizedPnl;
            totalCostValue += token.totalBalance * token.costBasis;
          }
        }

        setStats({
          totalValue: portfolio.totalUsd,
          change24h: portfolio.change24hUsd || 0,
          change24hPercent: portfolio.change24hPercent || 0,
          defiValue: 0, // Will be populated when DeFi tracking is added
          totalPnl,
          totalPnlPercent: totalCostValue > 0 ? (totalPnl / totalCostValue) * 100 : 0,
          tokenCount: portfolio.tokens.length,
          walletCount: wallets?.length || 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        {error || "No data available. Add wallets to get started."}
      </div>
    );
  }

  const isPositive = stats.change24hPercent >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="total-value">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Portfolio Value
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          {stats.change24h !== 0 && (
            <div className={`flex items-center text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {isPositive ? "+" : ""}{stats.change24hPercent.toFixed(2)}% (${Math.abs(stats.change24h).toLocaleString(undefined, { maximumFractionDigits: 2 })})
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            DeFi Value
          </CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats.defiValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-muted-foreground">
            {stats.totalValue > 0 ? ((stats.defiValue / stats.totalValue) * 100).toFixed(1) : 0}% of portfolio
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total P&L
          </CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm ${stats.totalPnlPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.totalPnlPercent >= 0 ? "+" : ""}{stats.totalPnlPercent.toFixed(2)}% all time
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Assets & Wallets
          </CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.tokenCount} tokens
          </div>
          <div className="text-sm text-muted-foreground">
            across {stats.walletCount} wallets
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
