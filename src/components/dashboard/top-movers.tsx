"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PortfolioResponse, PortfolioToken } from "@/app/api/portfolio/route";

interface MoverToken {
  tokenId: string;
  symbol: string;
  change24h: number;
}

export function TopMovers() {
  const [movers, setMovers] = useState<MoverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMovers() {
      try {
        const response = await fetch("/api/portfolio");
        if (!response.ok) {
          throw new Error("Failed to fetch portfolio");
        }

        const data: PortfolioResponse = await response.json();
        
        // Filter tokens with 24h change data and sort by absolute change
        const tokensWithChange = data.tokens
          .filter((t) => t.change24h !== null)
          .map((t) => ({
            tokenId: t.tokenId,
            symbol: t.symbol,
            change24h: t.change24h!,
          }))
          .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
          .slice(0, 4);

        setMovers(tokensWithChange);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchMovers();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Movers (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Movers (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (movers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Movers (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            No price data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Movers (24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {movers.map((token) => {
            const isPositive = token.change24h >= 0;
            return (
              <div key={token.tokenId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold">
                    {token.symbol.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{token.symbol.toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground">{token.tokenId}</p>
                  </div>
                </div>
                <Badge 
                  variant={isPositive ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{token.change24h.toFixed(2)}%
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
