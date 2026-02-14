"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { mockTokens } from "@/lib/mock-data";

interface AlertEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertId?: number | null;
}

export function AlertEditor({ open, onOpenChange }: AlertEditorProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("price");
  const [tokenId, setTokenId] = useState("");
  const [operator, setOperator] = useState("gt");
  const [value, setValue] = useState("");
  const [channel, setChannel] = useState("telegram");

  const handleSave = () => {
    console.log("Saving alert:", { name, type, tokenId, operator, value, channel });
    onOpenChange(false);
    // Reset form
    setName("");
    setType("price");
    setTokenId("");
    setOperator("gt");
    setValue("");
  };

  const showTokenSelect = type === "price" || type === "pnl_percent";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Alert</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Alert Name</label>
            <Input
              placeholder="e.g., BTC above 70k"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Alert Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Token Price</SelectItem>
                <SelectItem value="portfolio_value">Portfolio Value</SelectItem>
                <SelectItem value="pnl_percent">P&L Percentage</SelectItem>
                <SelectItem value="allocation">Allocation %</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showTokenSelect && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Token</label>
              <Select value={tokenId} onValueChange={setTokenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {mockTokens.map((token) => (
                    <SelectItem key={token.id} value={token.id}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Condition</label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gt">Goes above</SelectItem>
                  <SelectItem value="lt">Goes below</SelectItem>
                  <SelectItem value="crosses_above">Crosses above</SelectItem>
                  <SelectItem value="crosses_below">Crosses below</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Value {type === "pnl_percent" || type === "allocation" ? "(%)" : "($)"}
              </label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notification Channel</label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="ntfy">Ntfy.sh</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Alert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
