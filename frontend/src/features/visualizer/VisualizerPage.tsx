"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { OfficeFloorPlan } from "./OfficeFloorPlan";

export function VisualizerPage() {
  const { state, error } = useOfficeDataContext();

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Visualizer"
        title="Office floor plan"
        description="Live room and device state from a top-down view."
      />
      <OfficeFloorPlan rooms={state.rooms} devices={state.devices} nodes={state.nodes} alerts={state.activeAlerts} />
    </div>
  );
}
