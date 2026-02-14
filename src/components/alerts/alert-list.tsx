"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Pencil, Trash2, Plus } from "lucide-react";
import { mockAlerts } from "@/lib/mock-data";

interface AlertListProps {
  onAddAlert: () => void;
  onEditAlert: (alertId: number) => void;
}

const operatorLabels: Record<string, string> = {
  gt: "above",
  lt: "below",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
};

export function AlertList({ onAddAlert, onEditAlert }: AlertListProps) {
  const formatCondition = (condition: typeof mockAlerts[0]["condition"]) => {
    const operator = operatorLabels[condition.operator] || condition.operator;
    const value = condition.value.toLocaleString();
    
    switch (condition.type) {
      case "price":
        return `Price ${operator} $${value}`;
      case "portfolio_value":
        return `Portfolio value ${operator} $${value}`;
      case "pnl_percent":
        return `P&L ${operator} ${value}%`;
      default:
        return `${condition.type} ${operator} ${value}`;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Alert Rules</CardTitle>
        <Button onClick={onAddAlert}>
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${alert.enabled ? "bg-primary/10" : "bg-muted"}`}>
                  {alert.enabled ? (
                    <Bell className="h-5 w-5 text-primary" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{alert.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCondition(alert.condition)}
                  </p>
                  {alert.condition.token_id && (
                    <Badge variant="outline" className="mt-1">
                      {alert.condition.token_id.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right text-sm text-muted-foreground">
                  {alert.lastFired ? (
                    <span>Last fired: {alert.lastFired}</span>
                  ) : (
                    <span>Never fired</span>
                  )}
                </div>
                
                <Switch checked={alert.enabled} />
                
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEditAlert(alert.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {mockAlerts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alerts configured</p>
              <p className="text-sm">Create your first alert to get notified</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
