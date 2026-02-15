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
        const [portfolioRes, walletsRes, defiRes] = await Promise.all([
          fetch("/api/portfolio"),
          fetch("/api/wallets"),
          fetch("/api/defi").catch(() => null), // DeFi is optional
        ]);

        if (!portfolioRes.ok || !walletsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const portfolio: PortfolioResponse = await portfolioRes.json();
        const { wallets } = await walletsRes.json();
        
        // Fetch DeFi value (optional - may not be configured)
        let defiValue = 0;
        if (defiRes?.ok) {
          const defi = await defiRes.json();
          defiValue = defi.totalUsd || 0;
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

        // Add DeFi value to total (vault tokens aren't priced by portfolio endpoint)
        const combinedTotal = portfolio.totalUsd + defiValue;
        
        setStats({
          totalValue: combinedTotal,
          change24h: portfolio.change24hUsd || 0,
          change24hPercent: portfolio.change24hPercent || 0,
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
