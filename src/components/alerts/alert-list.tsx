"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Bell, Loader2 } from "lucide-react";
import { Alert, AlertsResponse } from "@/app/api/alerts/route";

interface AlertListProps {
  onAddAlert: () => void;
  onEditAlert: (alertId: number) => void;
}

export function AlertList({ onAddAlert, onEditAlert }: AlertListProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const response = await fetch("/api/alerts");
      if (!response.ok) throw new Error("Failed to fetch alerts");
      const data: AlertsResponse = await response.json();
      setAlerts(data.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAlert(alert: Alert) {
    setTogglingId(alert.id);
    try {
      const response = await fetch("/api/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, enabled: !alert.enabled }),
      });
      
      if (response.ok) {
        setAlerts(prev => prev.map(a => 
          a.id === alert.id ? { ...a, enabled: !a.enabled } : a
        ));
      }
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteAlert(id: number) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const formatCondition = (condition: Alert["condition"]) => {
    const operatorMap = { gt: ">", lt: "<", gte: "≥", lte: "≤" };
    const op = operatorMap[condition.operator];
    
    if (condition.type === "price") {
      return `${condition.token_id?.toUpperCase()} ${op} $${condition.value.toLocaleString()}`;
    } else if (condition.type === "portfolio_value") {
      return `Portfolio ${op} $${condition.value.toLocaleString()}`;
    } else if (condition.type === "pnl_percent") {
      return `P&L ${op} ${condition.value}%`;
    }
    return "Unknown condition";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Alerts</CardTitle>
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
          <CardTitle>Price Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Price Alerts
        </CardTitle>
        <Button onClick={onAddAlert}>
          <Plus className="h-4 w-4 mr-2" />
          Add Alert
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-4 bg-accent/30 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={() => toggleAlert(alert)}
                  disabled={togglingId === alert.id}
                />
                <div>
                  <p className="font-medium">{alert.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCondition(alert.condition)}
                  </p>
                  {alert.last_fired && (
                    <p className="text-xs text-muted-foreground">
                      Last triggered: {new Date(alert.last_fired).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={alert.enabled ? "default" : "secondary"}>
                  {alert.enabled ? "Active" : "Paused"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditAlert(alert.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteAlert(alert.id)}
                  disabled={deletingId === alert.id}
                >
                  {deletingId === alert.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alerts configured</p>
              <p className="text-sm">Create an alert to get notified when thresholds are hit</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
