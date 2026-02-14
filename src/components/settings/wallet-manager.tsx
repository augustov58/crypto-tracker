"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Wallet, Copy, ExternalLink, Loader2 } from "lucide-react";
import { DbWallet } from "@/lib/supabase";

const chains = [
  { id: "ethereum", name: "Ethereum", explorer: "https://etherscan.io/address/" },
  { id: "base", name: "Base", explorer: "https://basescan.org/address/" },
  { id: "arbitrum", name: "Arbitrum", explorer: "https://arbiscan.io/address/" },
  { id: "solana", name: "Solana", explorer: "https://solscan.io/account/" },
  { id: "bitcoin", name: "Bitcoin", explorer: "https://blockstream.info/address/" },
  { id: "bittensor", name: "Bittensor", explorer: "https://taostats.io/account/" },
  { id: "alephium", name: "Alephium", explorer: "https://explorer.alephium.org/addresses/" },
];

const chainColors: Record<string, string> = {
  ethereum: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  base: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  arbitrum: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  solana: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  bitcoin: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  bittensor: "bg-green-500/10 text-green-500 border-green-500/20",
  alephium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export function WalletManager() {
  const [wallets, setWallets] = useState<DbWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [newChain, setNewChain] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Fetch wallets on mount
  useEffect(() => {
    fetchWallets();
  }, []);

  async function fetchWallets() {
    try {
      const response = await fetch("/api/wallets");
      if (!response.ok) {
        throw new Error("Failed to fetch wallets");
      }
      const data = await response.json();
      setWallets(data.wallets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const handleAddWallet = async () => {
    setAddError(null);
    setIsAdding(true);

    try {
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: newChain,
          address: newAddress,
          label: newLabel || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add wallet");
      }

      // Add new wallet to list
      setWallets((prev) => [...prev, data.wallet]);
      setIsAddOpen(false);
      setNewChain("");
      setNewAddress("");
      setNewLabel("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteWallet = async (id: number) => {
    setIsDeleting(id);

    try {
      const response = await fetch(`/api/wallets?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete wallet");
      }

      // Remove wallet from list
      setWallets((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  const groupedWallets = chains.map((chain) => ({
    ...chain,
    wallets: wallets.filter((w) => w.chain === chain.id),
  })).filter((c) => c.wallets.length > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
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
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Addresses
          </CardTitle>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Wallet
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {groupedWallets.map((chain) => (
              <div key={chain.id}>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Badge variant="outline" className={chainColors[chain.id]}>
                    {chain.name}
                  </Badge>
                  <span className="text-muted-foreground">
                    {chain.wallets.length} wallet{chain.wallets.length !== 1 ? "s" : ""}
                  </span>
                </h3>
                
                <div className="space-y-2">
                  {chain.wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex items-center justify-between p-3 bg-accent/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono">
                          {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                        </code>
                        {wallet.label && (
                          <span className="text-sm text-muted-foreground">
                            ({wallet.label})
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyAddress(wallet.address)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={`${chain.explorer}${wallet.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteWallet(wallet.id)}
                          disabled={isDeleting === wallet.id}
                        >
                          {isDeleting === wallet.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {groupedWallets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No wallets configured</p>
                <p className="text-sm">Add your first wallet to start tracking</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {addError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {addError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Chain</label>
              <Select value={newChain} onValueChange={setNewChain}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {chains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input
                placeholder="0x... or other format"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Label (optional)</label>
              <Input
                placeholder="e.g., Main Wallet, Cold Storage"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddWallet}
              disabled={!newChain || !newAddress || isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Wallet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
