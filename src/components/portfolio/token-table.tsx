"use client";

import { useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { PortfolioResponse, PortfolioToken } from "@/app/api/portfolio/route";

export function TokenTable() {
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const response = await fetch("/api/portfolio");
        if (!response.ok) {
          throw new Error("Failed to fetch portfolio");
        }
        const data: PortfolioResponse = await response.json();
        setTokens(data.tokens);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, []);

  const toggleExpand = (tokenId: string) => {
    setExpandedToken(expandedToken === tokenId ? null : tokenId);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
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
          <CardTitle>Token Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tokens.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No tokens found. Add wallets and run a snapshot to see your holdings.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">24h</TableHead>
              <TableHead className="text-right">P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <Fragment key={token.tokenId}>
                <TableRow
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => toggleExpand(token.tokenId)}
                  data-testid="token-row"
                >
                  <TableCell>
                    <Button variant="ghost" size="sm" className="p-0 h-auto">
                      {expandedToken === token.tokenId ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-sm">
                        {token.symbol.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{token.symbol.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">
                          {token.tokenId}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {token.totalBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {token.price !== null ? (
                      `$${token.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {token.usdValue !== null ? (
                      `$${token.usdValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {token.change24h !== null ? (
                      <Badge
                        variant={token.change24h >= 0 ? "default" : "destructive"}
                        className="flex items-center gap-1 justify-end"
                      >
                        {token.change24h >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {token.change24h >= 0 ? "+" : ""}
                        {token.change24h.toFixed(2)}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {token.unrealizedPnl !== undefined ? (
                      <div
                        className={
                          token.unrealizedPnl >= 0 ? "text-green-500" : "text-red-500"
                        }
                      >
                        <div className="font-mono">
                          {token.unrealizedPnl >= 0 ? "+" : ""}$
                          {Math.abs(token.unrealizedPnl).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        {token.unrealizedPnlPercent !== undefined && (
                          <div className="text-xs">
                            {token.unrealizedPnlPercent >= 0 ? "+" : ""}
                            {token.unrealizedPnlPercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-xs">
                        No cost basis
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {expandedToken === token.tokenId && token.walletBreakdown.length > 0 && (
                  <TableRow className="bg-accent/20">
                    <TableCell colSpan={7} className="py-4">
                      <div className="pl-12">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium">
                            Per-Wallet Breakdown
                          </p>
                          {token.costBasis !== undefined && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                Avg Cost:{" "}
                              </span>
                              <span className="font-mono">
                                ${token.costBasis.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {token.walletBreakdown.map((wallet, idx) => (
                            <div
                              key={`${wallet.walletId}-${idx}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {wallet.chain}
                                </Badge>
                                <span className="font-mono text-muted-foreground">
                                  {wallet.address.slice(0, 8)}...
                                  {wallet.address.slice(-6)}
                                </span>
                                {wallet.walletLabel && (
                                  <span className="text-muted-foreground">
                                    ({wallet.walletLabel})
                                  </span>
                                )}
                              </div>
                              <div className="text-right font-mono">
                                <span>
                                  {wallet.balance.toLocaleString(undefined, {
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {token.symbol.toUpperCase()}
                                </span>
                                {wallet.usdValue !== null && (
                                  <span className="text-muted-foreground ml-4">
                                    ${wallet.usdValue.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
