"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Plus,
  X,
  HelpCircle,
} from "lucide-react";
import { useReconciliation, type ReconciliationItem } from "@/lib/hooks/use-reconciliation";
import { useCostBasis } from "@/lib/hooks/use-cost-basis";
import { LotEditor } from "./lot-editor";
import type { Lot } from "@/lib/pnl/types";

export function ReconciliationSection() {
  const { items, summary, loading, error, refetch } = useReconciliation();
  const { addLot, entries: costBasisEntries, refetch: refetchCostBasis } = useCostBasis();
  
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const [showBalanced, setShowBalanced] = useState(false);
  const [processingToken, setProcessingToken] = useState<string | null>(null);
  
  // Lot editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTokenId, setEditorTokenId] = useState<string | null>(null);
  const [editorSymbol, setEditorSymbol] = useState<string>("");
  const [editorPrefillQty, setEditorPrefillQty] = useState<number | null>(null);

  const toggleExpanded = (tokenId: string) => {
    const newSet = new Set(expandedTokens);
    if (newSet.has(tokenId)) {
      newSet.delete(tokenId);
    } else {
      newSet.add(tokenId);
    }
    setExpandedTokens(newSet);
  };

  const handleAddCostBasis = (item: ReconciliationItem) => {
    setEditorTokenId(item.tokenId);
    setEditorSymbol(item.symbol);
    setEditorPrefillQty(item.difference > 0 ? item.difference : item.walletBalance);
    setIsEditorOpen(true);
  };

  const handleMarkAsZero = async (item: ReconciliationItem) => {
    setProcessingToken(item.tokenId);
    try {
      const lot: Lot = {
        date: new Date().toISOString().split("T")[0],
        qty: item.difference > 0 ? item.difference : item.walletBalance,
        price_per_unit: 0,
        notes: "Reconciliation adjustment - marked as $0 cost",
      };
      
      await addLot(item.tokenId, item.symbol, lot);
      await refetchCostBasis();
      await refetch();
    } catch (err) {
      console.error("Failed to mark as zero:", err);
    } finally {
      setProcessingToken(null);
    }
  };

  const handleEditorClose = async () => {
    setIsEditorOpen(false);
    setEditorTokenId(null);
    setEditorSymbol("");
    setEditorPrefillQty(null);
    // Refresh data after editor closes
    await refetchCostBasis();
    await refetch();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={refetch}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // Separate items by status
  const needsAttention = items.filter(i => i.status !== 'balanced');
  const balanced = items.filter(i => i.status === 'balanced');

  const formatNumber = (num: number, decimals = 6) => {
    if (Math.abs(num) < 0.000001) return "0";
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: decimals 
    });
  };

  const formatUsd = (num: number | null) => {
    if (num === null) return "N/A";
    return `$${num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const getStatusBadge = (status: ReconciliationItem['status']) => {
    switch (status) {
      case 'balanced':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Balanced</Badge>;
      case 'no_cost_basis':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500"><HelpCircle className="h-3 w-3 mr-1" />No Cost Basis</Badge>;
      case 'under':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-500"><AlertTriangle className="h-3 w-3 mr-1" />Unaccounted</Badge>;
      case 'over':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500"><AlertTriangle className="h-3 w-3 mr-1" />Over-reported</Badge>;
    }
  };

  const renderItem = (item: ReconciliationItem) => {
    const isExpanded = expandedTokens.has(item.tokenId);
    const isProcessing = processingToken === item.tokenId;
    
    return (
      <div 
        key={item.tokenId} 
        className="border rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-sm flex-shrink-0">
              {item.symbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{item.symbol}</p>
              <p className="text-sm text-muted-foreground truncate">
                {formatNumber(item.walletBalance)} 
                {item.currentPrice && ` • ${formatUsd(item.walletBalance * item.currentPrice)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="hidden sm:block">
              {getStatusBadge(item.status)}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => toggleExpanded(item.tokenId)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Summary row */}
        {item.status !== 'balanced' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-muted/50 rounded-md p-3">
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground">Diff: </span>
              <span className={item.difference > 0 ? "text-orange-500 font-medium" : "text-red-500 font-medium"}>
                {item.difference > 0 ? "+" : ""}{formatNumber(item.difference)}
              </span>
              {item.differenceUsd !== null && (
                <span className="text-muted-foreground ml-1">
                  ({formatUsd(Math.abs(item.differenceUsd))})
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleAddCostBasis(item)}
                disabled={isProcessing}
                className="flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Add Cost</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleMarkAsZero(item)}
                disabled={isProcessing}
                className="flex-1 sm:flex-none"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">$0 Cost</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="pt-2 border-t space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Wallet</p>
                <p className="font-mono text-xs sm:text-sm truncate">{formatNumber(item.walletBalance)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Cost Basis</p>
                <p className="font-mono text-xs sm:text-sm truncate">{formatNumber(item.costBasisQty)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Price</p>
                <p className="font-mono text-xs sm:text-sm">{item.currentPrice ? formatUsd(item.currentPrice) : "N/A"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Diff Value</p>
                <p className="font-mono text-xs sm:text-sm">{formatUsd(item.differenceUsd)}</p>
              </div>
            </div>
            
            {item.status === 'under' && (
              <p className="text-orange-500/80 text-xs">
                ℹ️ You have more tokens in your wallet than your cost basis accounts for. 
                This could be from rewards, airdrops, or unrecorded purchases.
              </p>
            )}
            {item.status === 'over' && (
              <p className="text-red-500/80 text-xs">
                ⚠️ Your cost basis claims more tokens than your wallet shows. 
                You may have sold or transferred tokens without recording it.
              </p>
            )}
            {item.status === 'no_cost_basis' && (
              <p className="text-yellow-500/80 text-xs">
                ℹ️ No cost basis recorded for this token. Add your purchase history to track PnL.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                Reconciliation
                {summary && summary.needsAttention + summary.noCostBasis > 0 && (
                  <Badge variant="destructive">
                    {summary.needsAttention + summary.noCostBasis}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Compare wallet vs cost basis
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refetch} className="self-start sm:self-auto">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b">
              <div className="text-center">
                <p className="text-2xl font-bold">{summary.totalTokens}</p>
                <p className="text-sm text-muted-foreground">Total Tokens</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{summary.balanced}</p>
                <p className="text-sm text-muted-foreground">Balanced</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{summary.needsAttention}</p>
                <p className="text-sm text-muted-foreground">Mismatched</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">{summary.noCostBasis}</p>
                <p className="text-sm text-muted-foreground">No Cost Basis</p>
              </div>
            </div>
          )}

          {/* Items needing attention */}
          {needsAttention.length > 0 ? (
            <div className="space-y-3">
              {needsAttention.map(renderItem)}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>All tokens are reconciled!</p>
            </div>
          )}

          {/* Balanced items (collapsible) */}
          {balanced.length > 0 && (
            <Collapsible open={showBalanced} onOpenChange={setShowBalanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {balanced.length} balanced token{balanced.length !== 1 ? 's' : ''}
                  </span>
                  {showBalanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                {balanced.map(renderItem)}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Lot Editor Dialog */}
      <LotEditor
        open={isEditorOpen}
        onOpenChange={handleEditorClose}
        tokenId={editorTokenId}
        existingLot={null}
        existingEntries={costBasisEntries}
        prefillQty={editorPrefillQty}
        prefillSymbol={editorSymbol}
      />
    </>
  );
}
