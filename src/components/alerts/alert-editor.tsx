"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { Alert, AlertCondition } from "@/app/api/alerts/route";
import { PortfolioToken } from "@/app/api/portfolio/route";

interface AlertEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertId: number | null;
}

const OPERATORS = [
  { value: "gt", label: "Greater than (>)" },
  { value: "lt", label: "Less than (<)" },
  { value: "gte", label: "Greater or equal (≥)" },
  { value: "lte", label: "Less or equal (≤)" },
];

const ALERT_TYPES = [
  { value: "price", label: "Token Price" },
  { value: "portfolio_value", label: "Portfolio Value" },
];

export function AlertEditor({ open, onOpenChange, alertId }: AlertEditorProps) {
  const [name, setName] = useState("");
  const [alertType, setAlertType] = useState<"price" | "portfolio_value">("price");
  const [tokenId, setTokenId] = useState("");
  const [operator, setOperator] = useState<AlertCondition["operator"]>("gt");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);

  // Fetch tokens for dropdown
  useEffect(() => {
    async function fetchTokens() {
      try {
        const response = await fetch("/api/portfolio");
        if (response.ok) {
          const data = await response.json();
          setTokens(data.tokens || []);
        }
      } catch {
        console.error("Failed to fetch tokens");
      }
    }
    fetchTokens();
  }, []);

  // Load existing alert if editing
  useEffect(() => {
    if (!open) {
      // Reset form when closed
      setName("");
      setAlertType("price");
      setTokenId("");
      setOperator("gt");
      setValue("");
      setError(null);
      return;
    }

    if (alertId) {
      setLoading(true);
      fetch("/api/alerts")
        .then((res) => res.json())
        .then((data) => {
          const alert = data.alerts?.find((a: Alert) => a.id === alertId);
          if (alert) {
            setName(alert.name);
            setAlertType(alert.condition.type as "price" | "portfolio_value");
            setTokenId(alert.condition.token_id || "");
            setOperator(alert.condition.operator);
            setValue(alert.condition.value.toString());
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, alertId]);

  const handleSave = async () => {
    setError(null);
    
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    
    if (alertType === "price" && !tokenId) {
      setError("Please select a token");
      return;
    }
    
    if (!value || isNaN(parseFloat(value))) {
      setError("Please enter a valid value");
      return;
    }

    setSaving(true);

    try {
      const condition: AlertCondition = {
        type: alertType,
        operator,
        value: parseFloat(value),
        ...(alertType === "price" && { token_id: tokenId }),
      };

      const method = alertId ? "PUT" : "POST";
      const body = alertId
        ? { id: alertId, name, condition }
        : { name, condition };

      const response = await fetch("/api/alerts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save alert");
      }

      onOpenChange(false);
      // Trigger a page refresh to update the list
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{alertId ? "Edit Alert" : "Create Alert"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Alert Name</label>
              <Input
                placeholder="e.g., BTC above 100k"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Alert Type</label>
              <Select value={alertType} onValueChange={(v) => setAlertType(v as "price" | "portfolio_value")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {alertType === "price" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Token</label>
                <Select value={tokenId} onValueChange={setTokenId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => (
                      <SelectItem key={token.tokenId} value={token.tokenId}>
                        {token.symbol.toUpperCase()} - ${token.price?.toLocaleString() || "N/A"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Condition</label>
                <Select value={operator} onValueChange={(v) => setOperator(v as AlertCondition["operator"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {alertType === "price" ? "Price ($)" : "Value ($)"}
                </label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Alert"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
