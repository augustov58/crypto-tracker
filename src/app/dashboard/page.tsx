import { PortfolioValueChart } from "@/components/dashboard/portfolio-value-chart";
import { AllocationPie } from "@/components/dashboard/allocation-pie";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { TopMovers } from "@/components/dashboard/top-movers";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your crypto portfolio</p>
      </div>

      <QuickStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PortfolioValueChart />
        </div>
        <div>
          <AllocationPie />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopMovers />
      </div>
    </div>
  );
}
