"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { mockDefiPositions } from "@/lib/mock-data";

const typeColors: Record<string, string> = {
  staking: "bg-green-500/10 text-green-500",
  lending: "bg-blue-500/10 text-blue-500",
  lp: "bg-purple-500/10 text-purple-500",
  yield: "bg-amber-500/10 text-amber-500",
};

export function DefiPositions() {
  const totalDefi = mockDefiPositions.reduce(
    (sum, p) => sum + p.tokens.reduce((s, t) => s + t.usdValue, 0),
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <CardTitle>DeFi Positions</CardTitle>
        <div className="sm:text-right">
          <p className="text-2xl font-bold">${totalDefi.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total DeFi Value</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockDefiPositions.map((position, index) => (
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
                    </div>
                    <div className="mt-2 space-y-1">
                      {position.tokens.map((token, i) => (
                        <div key={i} className="flex items-center gap-2 sm:gap-4 text-sm flex-wrap">
                          <span className="font-mono">
                            {token.amount.toLocaleString()} {token.symbol}
                          </span>
                          <span className="text-muted-foreground">
                            ${token.usdValue.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 pl-13 sm:pl-0">
                  <p className="font-mono font-medium">
                    ${position.tokens.reduce((s, t) => s + t.usdValue, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-green-500">{position.apy}% APY</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
