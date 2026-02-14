"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";

export function ApiKeysSettings() {
  const [zerionKey, setZerionKey] = useState("");
  const [savedZerionKey, setSavedZerionKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load saved key on mount
  useEffect(() => {
    async function loadKey() {
      try {
        const res = await fetch("/api/settings/api-keys");
        if (res.ok) {
          const data = await res.json();
          if (data.zerionKey) {
            setSavedZerionKey(data.zerionKey);
            setZerionKey(data.zerionKey);
          }
        }
      } catch (err) {
        console.error("Failed to load API keys:", err);
      }
    }
    loadKey();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zerionKey }),
      });
      
      if (res.ok) {
        setSavedZerionKey(zerionKey);
        setTestResult({ success: true, message: "API key saved successfully!" });
      } else {
        const data = await res.json();
        setTestResult({ success: false, message: data.error || "Failed to save" });
      }
    } catch (err) {
      setTestResult({ success: false, message: "Failed to save API key" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch("/api/settings/api-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zerionKey: zerionKey || savedZerionKey }),
      });
      
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success 
          ? `Connected! Found ${data.positionCount || 0} DeFi positions worth $${data.totalValue?.toLocaleString() || 0}.`
          : data.error || "Connection failed",
      });
    } catch (err) {
      setTestResult({ success: false, message: "Test request failed" });
    } finally {
      setTesting(false);
    }
  };

  const hasChanges = zerionKey !== savedZerionKey;

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Configure external API integrations for enhanced DeFi tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zerion-key">Zerion API Key</Label>
            <div className="flex gap-2">
              <Input
                id="zerion-key"
                type="password"
                placeholder="zk_..."
                value={zerionKey}
                onChange={(e) => setZerionKey(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || (!zerionKey && !savedZerionKey)}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Get a free API key at{" "}
              <a
                href="https://developers.zerion.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                developers.zerion.io
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save API Key"
            )}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">What Zerion provides:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• DeFi positions across 100+ protocols (Aave, Compound, Uniswap, etc.)</li>
            <li>• Yield farming & staking positions</li>
            <li>• LP positions with detailed token breakdowns</li>
            <li>• Debt/borrowing positions</li>
            <li>• Support for vaults.fyi and other yield aggregators</li>
            <li>• Claimable rewards and airdrops</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
