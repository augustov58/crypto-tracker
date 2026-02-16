import { CostBasisTable } from "@/components/cost-basis/cost-basis-table";
import { PnlSummary } from "@/components/cost-basis/pnl-summary";
import { CSVImport } from "@/components/cost-basis/csv-import";
import { ReconciliationSection } from "@/components/cost-basis/reconciliation-section";

export default function CostBasisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cost Basis & P&L</h1>
        <p className="text-muted-foreground">Manage your acquisition lots and track gains</p>
      </div>

      <PnlSummary />
      <ReconciliationSection />
      <CostBasisTable />
      <CSVImport />
    </div>
  );
}
