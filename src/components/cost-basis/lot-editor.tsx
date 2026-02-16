"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCostBasis, type CostBasisEntry } from "@/lib/hooks/use-cost-basis";
import type { Lot } from "@/lib/pnl/types";

// Common tokens for quick selection
const COMMON_TOKENS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'bittensor', symbol: 'TAO', name: 'Bittensor' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'alephium', symbol: 'ALPH', name: 'Alephium' },
  { id: 'base', symbol: 'BASE', name: 'Base' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave' },
];

interface LotEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId?: string | null;
  existingLot?: { lot: Lot; index: number } | null;
  existingEntries?: CostBasisEntry[];
  prefillQty?: number | null;
  prefillSymbol?: string;
}

export function LotEditor({
  open,
  onOpenChange,
  tokenId,
  existingLot,
  existingEntries = [],
  prefillQty,
  prefillSymbol,
}: LotEditorProps) {
  const { addLot, updateLots } = useCostBasis();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [customTokenId, setCustomTokenId] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [date, setDate] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [isSell, setIsSell] = useState(false);

  // Determine if editing or creating
  const isEditing = !!existingLot;

  // Reset form when dialog opens/closes or props change
  useEffect(() => {
    if (open) {
      setError(null);
      if (existingLot) {
        // Editing existing lot
        setSelectedTokenId(tokenId || "");
        setCustomTokenId("");
        setCustomSymbol("");
        setDate(existingLot.lot.date);
        setQty(Math.abs(existingLot.lot.qty).toString());
        setPrice(existingLot.lot.price_per_unit.toString());
        setNotes(existingLot.lot.notes || "");
        setIsSell(existingLot.lot.qty < 0);
      } else {
        // Creating new lot
        // Check if tokenId is a known token or if we should use custom
        const knownToken = COMMON_TOKENS.find(t => t.id === tokenId);
        const existingEntry = existingEntries.find(e => e.token_id === tokenId);
        
        if (tokenId && !knownToken && !existingEntry) {
          // Unknown token - use custom mode with prefillSymbol
          setSelectedTokenId("custom");
          setCustomTokenId(tokenId);
          setCustomSymbol(prefillSymbol || "");
        } else {
          setSelectedTokenId(tokenId || "");
          setCustomTokenId("");
          setCustomSymbol("");
        }
        
        setDate(new Date().toISOString().split("T")[0]);
        setQty(prefillQty ? prefillQty.toString() : "");
        setPrice("");
        setNotes("");
        setIsSell(false);
      }
    }
  }, [open, tokenId, existingLot, prefillQty, prefillSymbol, existingEntries]);

  // Get symbol for the selected token
  const getSymbol = (): string => {
    if (selectedTokenId === "custom") {
      return customSymbol.toUpperCase();
    }
    const token = COMMON_TOKENS.find((t) => t.id === selectedTokenId);
    if (token) return token.symbol;
    const entry = existingEntries.find((e) => e.token_id === selectedTokenId);
    return entry?.symbol || selectedTokenId.toUpperCase();
  };

  const getTokenId = (): string => {
    if (selectedTokenId === "custom") {
      return customTokenId.toLowerCase();
    }
    return selectedTokenId;
  };

  const handleSave = async () => {
    setError(null);
    
    // Validation
    const finalTokenId = getTokenId();
    const finalSymbol = getSymbol();
    
    if (!finalTokenId) {
      setError("Please select or enter a token");
      return;
    }
    
    if (selectedTokenId === "custom" && !customSymbol) {
      setError("Please enter a symbol for the custom token");
      return;
    }
    
    if (!date) {
      setError("Please enter a date");
      return;
    }
    
    const qtyNum = parseFloat(qty);
    const priceNum = parseFloat(price);
    
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Please enter a valid positive quantity");
      return;
    }
    
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid positive price");
      return;
    }

    const newLot: Lot = {
      date,
      qty: isSell ? -qtyNum : qtyNum,
      price_per_unit: priceNum,
      notes: notes.trim() || undefined,
    };

    setSaving(true);

    try {
      if (isEditing && existingLot) {
        // Update existing lot
        const entry = existingEntries.find((e) => e.token_id === tokenId);
        if (entry) {
          const updatedLots = [...entry.lots];
          updatedLots[existingLot.index] = newLot;
          const success = await updateLots(entry.token_id, updatedLots);
          if (!success) {
            throw new Error("Failed to update lot");
          }
        }
      } else {
        // Add new lot
        const success = await addLot(finalTokenId, finalSymbol, newLot);
        if (!success) {
          throw new Error("Failed to add lot");
        }
      }
      
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  // Combine common tokens with existing entries
  const availableTokens = [
    ...COMMON_TOKENS,
    ...existingEntries
      .filter((e) => !COMMON_TOKENS.some((t) => t.id === e.token_id))
      .map((e) => ({ id: e.token_id, symbol: e.symbol, name: e.symbol })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Cost Basis Lot" : "Add Cost Basis Lot"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this cost basis lot"
              : "Record a buy or sell transaction for your cost basis"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Token Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Token</label>
            <Select
              value={selectedTokenId}
              onValueChange={setSelectedTokenId}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {availableTokens.map((token) => (
                  <SelectItem key={token.id} value={token.id}>
                    {token.symbol} - {token.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Token...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Token Fields */}
          {selectedTokenId === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Token ID</label>
                <Input
                  placeholder="e.g., dogecoin"
                  value={customTokenId}
                  onChange={(e) => setCustomTokenId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Symbol</label>
                <Input
                  placeholder="e.g., DOGE"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Transaction Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Transaction Type</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isSell ? "default" : "outline"}
                className="flex-1"
                onClick={() => setIsSell(false)}
              >
                Buy
              </Button>
              <Button
                type="button"
                variant={isSell ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => setIsSell(true)}
              >
                Sell
              </Button>
            </div>
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                data-testid="lot-qty"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Price per Unit ($)</label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                data-testid="lot-price"
              />
            </div>
          </div>

          {/* Total Display */}
          {qty && price && !isNaN(parseFloat(qty)) && !isNaN(parseFloat(price)) && (
            <div className="text-sm text-muted-foreground">
              Total: ${(parseFloat(qty) * parseFloat(price)).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              placeholder="e.g., DCA buy, limit order"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="lot-save">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Save"} Lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
