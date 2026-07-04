"use client";

import { AlertTriangle, Building2, Cpu, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricGrid, StatCard } from "@/components/shared/StatCard";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { formatBdt, formatKwh, formatWatts } from "@/lib/format";
import { OfficeFloorPlan } from "./OfficeFloorPlan";

export function VisualizerPage() {
  const { state, error } = useOfficeDataContext();

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Graphical view"
        title="Top-view office energy map."
        description="A hackathon-ready visualizer powered by backend room/device state. Lights glow when on, fans spin when on, and alert rooms are emphasized."
      />
      <MetricGrid>
        <StatCard label="Office load" value={formatWatts(state.officeSummary.currentPowerWatts)} helper={`${state.devices.filter((device) => device.status === "on").length} devices on`} icon={Zap} />
        <StatCard label="Today usage" value={formatKwh(state.officeSummary.unitKwhToday)} helper={formatBdt(state.officeSummary.costBdtToday)} icon={Building2} />
        <StatCard label="Active alerts" value={String(state.activeAlerts.length)} helper="Click highlighted rooms for detail" icon={AlertTriangle} tone={state.activeAlerts.length ? "warning" : "success"} />
        <StatCard label="Inventory" value={`${state.devices.length} devices`} helper={`${state.rooms.length} active rooms`} icon={Cpu} />
      </MetricGrid>
      <OfficeFloorPlan rooms={state.rooms} devices={state.devices} nodes={state.nodes} alerts={state.activeAlerts} />
    </div>
  );
}
