"use client";

import { useState } from "react";
import { AlertList } from "@/components/alerts/alert-list";
import { AlertEditor } from "@/components/alerts/alert-editor";

export default function AlertsPage() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null);

  const handleAddAlert = () => {
    setEditingAlertId(null);
    setIsEditorOpen(true);
  };

  const handleEditAlert = (alertId: number) => {
    setEditingAlertId(alertId);
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alerts</h1>
        <p className="text-muted-foreground">Get notified when thresholds are hit</p>
      </div>

      <AlertList onAddAlert={handleAddAlert} onEditAlert={handleEditAlert} />
      
      <AlertEditor 
        open={isEditorOpen} 
        onOpenChange={setIsEditorOpen}
        alertId={editingAlertId}
      />
    </div>
  );
}
