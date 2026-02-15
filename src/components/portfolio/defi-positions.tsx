"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DefiPosition } from "@/lib/defi/debank";

interface DefiResponse {
  positions: DefiPosition[];
  totalUsd: number;
  source: 'zerion' | 'debank' | 'token-detection';
}

const typeColors: Record<string, string> = {
  staking: "bg-green-500/10 text-green-500",
  lending: "bg-blue-500/10 text-blue-500",
  lp: "bg-purple-500/10 text-purple-500",
  yield: "bg-amber-500/10 text-amber-500",
};

export function DefiPositions() {
  const [positions, setPositions] = useState<DefiPosition[]>([]);
  const [totalDefi, setTotalDefi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDefi() {
      try {
        const response = await fetch("/api/defi");
        if (!response.ok) {
          throw new Error("Failed to fetch DeFi positions");
        }
        const data: DefiResponse = await response.json();
        setPositions(data.positions);
        setTotalDefi(data.totalUsd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchDefi();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>DeFi Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
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
          <CardTitle>DeFi Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>DeFi Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No DeFi positions detected. Staking tokens like stETH, rETH, or aTokens will appear here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <CardTitle>DeFi Positions</CardTitle>
        <div className="sm:text-right">
          <p className="text-2xl font-bold">${totalDefi.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="text-sm text-muted-foreground">Total DeFi Value</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.map((position, index) => (
            <div key={position.id}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center font-bold shrink-0">
                    {position.protocol.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{position.protocol}</p>
                      <Badge variant="secondary" className={typeColors[position.type]}>
                        {position.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {position.chain}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {position.tokens.map((token, i) => (
                        <div key={i} className="flex items-center gap-2 sm:gap-4 text-sm flex-wrap">
                          <span className="font-mono">
                            {token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}
                          </span>
                          <span className={token.isEstimated ? "text-amber-500" : "text-muted-foreground"}>
                            {token.isEstimated && "~"}${token.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            {token.isEstimated && (
                              <span className="text-xs ml-1" title="Estimated based on stablecoin assumption">(est)</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 pl-13 sm:pl-0">
                  <p className={`font-mono font-medium ${position.tokens.some(t => t.isEstimated) ? 'text-amber-500' : ''}`}>
                    {position.tokens.some(t => t.isEstimated) && "~"}
                    ${position.netUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  {position.hasUnpricedTokens && (
                    <p className="text-xs text-muted-foreground">+ unpriced tokens</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
