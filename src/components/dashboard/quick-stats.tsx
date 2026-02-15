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
        // Fetch from snapshots (includes DeFi) + portfolio (for 24h change) + wallets
        const [snapshotsRes, portfolioRes, walletsRes] = await Promise.all([
          fetch("/api/snapshots?from=" + new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()),
          fetch("/api/portfolio"),
          fetch("/api/wallets"),
        ]);

        if (!snapshotsRes.ok || !portfolioRes.ok || !walletsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const snapshots = await snapshotsRes.json();
        const portfolio: PortfolioResponse = await portfolioRes.json();
        const { wallets } = await walletsRes.json();
        
        // Use latest snapshot for total value (includes DeFi)
        const latestSnapshot = snapshots.snapshots[snapshots.snapshots.length - 1];
        const totalValue = latestSnapshot?.totalUsd || portfolio.totalUsd;
        const defiValue = latestSnapshot?.defiUsd || 0;

        // Calculate 24h change from snapshots if we have enough data
        let change24h = portfolio.change24hUsd || 0;
        let change24hPercent = portfolio.change24hPercent || 0;
        
        if (snapshots.snapshots.length >= 2) {
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          // Find snapshot closest to 24h ago
          const oldSnapshot = snapshots.snapshots.find((s: { timestamp: string }) => 
            new Date(s.timestamp) <= oneDayAgo
          ) || snapshots.snapshots[0];
          
          if (oldSnapshot && latestSnapshot) {
            change24h = latestSnapshot.totalUsd - oldSnapshot.totalUsd;
            change24hPercent = oldSnapshot.totalUsd > 0 
              ? ((latestSnapshot.totalUsd - oldSnapshot.totalUsd) / oldSnapshot.totalUsd) * 100 
              : 0;
          }
        }

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
          totalValue,
          change24h,
          change24hPercent,
          defiValue,
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="total-value">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            Portfolio Value
          </CardTitle>
          <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold truncate">
            ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          {stats.change24h !== 0 && (
            <div className={`flex items-center text-xs sm:text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" /> : <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />}
              <span className="truncate">{isPositive ? "+" : ""}{stats.change24hPercent.toFixed(1)}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            DeFi Value
          </CardTitle>
          <PiggyBank className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold truncate">
            ${stats.defiValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground truncate">
            {stats.defiValue > 0 
              ? `${((stats.defiValue / stats.totalValue) * 100).toFixed(1)}% of portfolio` 
              : "0.0% of portfolio"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            Total P&L
          </CardTitle>
          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className={`text-lg sm:text-2xl font-bold truncate ${stats.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className={`text-xs sm:text-sm truncate ${stats.totalPnlPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.totalPnlPercent >= 0 ? "+" : ""}{stats.totalPnlPercent.toFixed(1)}% all time
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            Assets & Wallets
          </CardTitle>
          <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold">
            {stats.tokenCount} tokens
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            across {stats.walletCount} wallets
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
