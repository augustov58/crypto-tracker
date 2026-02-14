"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useCostBasis } from "@/lib/hooks/use-cost-basis";
import { LotEditor } from "./lot-editor";
import { calculateAverageCost, calculateTotalQty } from "@/lib/pnl/calculator";
import type { Lot } from "@/lib/pnl/types";

export function CostBasisTable() {
  const { entries, loading, error, deleteLot, refetch } = useCostBasis();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingLot, setEditingLot] = useState<{ lot: Lot; index: number } | null>(null);
  const [deletingLot, setDeletingLot] = useState<string | null>(null);

  const handleAddLot = (tokenId?: string) => {
    setEditingTokenId(tokenId || null);
    setEditingLot(null);
    setIsEditorOpen(true);
  };

  const handleEditLot = (tokenId: string, lot: Lot, index: number) => {
    setEditingTokenId(tokenId);
    setEditingLot({ lot, index });
    setIsEditorOpen(true);
  };

  const handleDeleteLot = async (tokenId: string, index: number) => {
    const key = `${tokenId}-${index}`;
    setDeletingLot(key);
    await deleteLot(tokenId, index);
    setDeletingLot(null);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingTokenId(null);
    setEditingLot(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-destructive">Error loading cost basis: {error}</p>
          <Button onClick={refetch}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cost Basis by Token</CardTitle>
          <Button onClick={() => handleAddLot()} data-testid="add-lot-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Lot
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No cost basis entries yet.</p>
              <Button onClick={() => handleAddLot()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Lot
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {entries.map((entry) => {
                const totalQty = calculateTotalQty(entry.lots);
                const avgPrice = calculateAverageCost(entry.lots);
                const totalCost = entry.lots
                  .filter((l) => l.qty > 0)
                  .reduce((sum, l) => sum + l.qty * l.price_per_unit, 0);

                return (
                  <div key={entry.token_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold">
                          {entry.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium">{entry.symbol}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.lots.length} lot{entry.lots.length !== 1 ? "s" : ""} • 
                            Holdings: {totalQty.toFixed(6)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          Avg: ${avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total Cost: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price/Unit</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.lots.map((lot, index) => {
                          const isDeleting = deletingLot === `${entry.token_id}-${index}`;
                          return (
                            <TableRow key={index} data-testid="lot-row">
                              <TableCell>{lot.date}</TableCell>
                              <TableCell className="text-right font-mono">
                                <Badge variant={lot.qty >= 0 ? "default" : "destructive"}>
                                  {lot.qty >= 0 ? "+" : ""}
                                  {lot.qty.toFixed(6)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${lot.price_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${Math.abs(lot.qty * lot.price_per_unit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                {lot.notes || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditLot(entry.token_id, lot, index)}
                                    disabled={isDeleting}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => handleDeleteLot(entry.token_id, index)}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddLot(entry.token_id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Lot
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LotEditor
        open={isEditorOpen}
        onOpenChange={handleEditorClose}
        tokenId={editingTokenId}
        existingLot={editingLot}
        existingEntries={entries}
      />
    </>
  );
}
