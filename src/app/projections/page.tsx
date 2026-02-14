"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortfolioStore } from "@/lib/store";
import { CagrProjection } from "@/components/projections/cagr-projection";
import { ScenarioProjection } from "@/components/projections/scenario-projection";
import { MonteCarloProjection } from "@/components/projections/monte-carlo-projection";

export default function ProjectionsPage() {
  const { projectionModel, setProjectionModel } = usePortfolioStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Projections</h1>
        <p className="text-muted-foreground">Explore future portfolio scenarios</p>
      </div>

      <Tabs value={projectionModel} onValueChange={(v) => setProjectionModel(v as typeof projectionModel)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="cagr">CAGR</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="montecarlo" data-testid="tab-montecarlo">Monte Carlo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="cagr" className="mt-6">
          <CagrProjection />
        </TabsContent>
        
        <TabsContent value="scenarios" className="mt-6">
          <ScenarioProjection />
        </TabsContent>
        
        <TabsContent value="montecarlo" className="mt-6">
          <MonteCarloProjection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
