"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useCostBasis } from "@/lib/hooks/use-cost-basis";

interface ImportResult {
  success: boolean;
  stats?: {
    lots_imported: number;
    total_lots: number;
    merged: boolean;
  };
  warnings?: string[];
  error?: string;
  details?: string[];
}

export function CSVImport() {
  const { refetch } = useCostBasis();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [targetSymbol, setTargetSymbol] = useState("");
  const [mergeExisting, setMergeExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);

    try {
      setImporting(true);
      const content = await file.text();

      const res = await fetch("/api/cost-basis/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv_content: content,
          target_symbol: targetSymbol || undefined,
          merge: mergeExisting,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          error: data.error,
          details: data.details,
          warnings: data.warnings,
        });
      } else {
        setResult({
          success: true,
          stats: data.stats,
          warnings: data.warnings,
        });
        await refetch();
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to import CSV",
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      // Create a synthetic event
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        handleFileSelect({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV Import
        </CardTitle>
        <CardDescription>
          Import cost basis data from Coinbase, Binance, or generic CSV exports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Filter by Symbol (optional)</label>
            <Input
              placeholder="e.g., BTC"
              value={targetSymbol}
              onChange={(e) => setTargetSymbol(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to import all tokens from the CSV
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Merge Options</label>
            <div className="flex items-center gap-2">
              <Switch
                checked={mergeExisting}
                onCheckedChange={setMergeExisting}
              />
              <span className="text-sm">
                {mergeExisting ? "Merge with existing lots" : "Replace existing lots"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {mergeExisting
                ? "New lots will be added to existing entries"
                : "Existing lots will be replaced"}
            </p>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
            disabled={importing}
          />
          
          {importing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm">
                <span className="font-medium text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">CSV files only</p>
            </div>
          )}
        </div>

        {/* Supported Formats */}
        <div className="text-sm">
          <p className="font-medium mb-2">Supported Formats:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Coinbase</Badge>
            <Badge variant="outline">Binance</Badge>
            <Badge variant="outline">Generic CSV</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Generic CSV should have columns: date, quantity (or qty), price (or price_per_unit)
          </p>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success ? "bg-green-500/10" : "bg-destructive/10"
            }`}
          >
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                {result.success ? (
                  <>
                    <p className="font-medium text-green-500">Import successful!</p>
                    {result.stats && (
                      <p className="text-sm">
                        Imported {result.stats.lots_imported} lots
                        {result.stats.merged && " (merged with existing)"}
                        . Total lots: {result.stats.total_lots}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-destructive">{result.error}</p>
                    {result.details && result.details.length > 0 && (
                      <ul className="text-sm list-disc list-inside">
                        {result.details.slice(0, 5).map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                        {result.details.length > 5 && (
                          <li>...and {result.details.length - 5} more errors</li>
                        )}
                      </ul>
                    )}
                  </>
                )}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="text-sm text-yellow-600 dark:text-yellow-500">
                    <p className="font-medium">Warnings:</p>
                    <ul className="list-disc list-inside">
                      {result.warnings.slice(0, 3).map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                      {result.warnings.length > 3 && (
                        <li>...and {result.warnings.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
