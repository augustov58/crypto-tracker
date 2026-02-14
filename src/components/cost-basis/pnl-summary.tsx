"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioStore, type PnlMethod } from "@/lib/store";
import { usePnL } from "@/lib/hooks/use-pnl";

export function PnlSummary() {
  const { pnlMethod, setPnlMethod } = usePortfolioStore();
  const { summary, loading, error } = usePnL();

  const unrealizedPnl = summary?.total_unrealized_pnl ?? 0;
  const realizedPnl = summary?.total_realized_pnl ?? 0;
  const totalPnl = unrealizedPnl + realizedPnl;
  const unrealizedPercent = summary?.total_unrealized_pnl_percent ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>P&L Summary</CardTitle>
        <Tabs value={pnlMethod} onValueChange={(v) => setPnlMethod(v as PnlMethod)}>
          <TabsList>
            <TabsTrigger value="fifo">FIFO</TabsTrigger>
            <TabsTrigger value="lifo">LIFO</TabsTrigger>
            <TabsTrigger value="average">Average</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-destructive text-center py-4">
            Error loading P&L: {error}
          </div>
        ) : !summary || summary.by_token.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">
            Add cost basis entries to see your P&L calculations
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Unrealized P&L</p>
              <p
                className={`text-2xl font-bold ${
                  unrealizedPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {unrealizedPnl >= 0 ? "+" : ""}$
                {Math.abs(unrealizedPnl).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p
                className={`text-sm ${
                  unrealizedPercent >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {unrealizedPercent >= 0 ? "+" : ""}
                {unrealizedPercent.toFixed(2)}%
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Realized P&L</p>
              <p
                className={`text-2xl font-bold ${
                  realizedPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {realizedPnl >= 0 ? "+" : ""}$
                {Math.abs(realizedPnl).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-sm text-muted-foreground">From closed positions</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total P&L</p>
              <p
                className={`text-2xl font-bold ${
                  totalPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {totalPnl >= 0 ? "+" : ""}$
                {Math.abs(totalPnl).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                Using {pnlMethod.toUpperCase()} method
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
