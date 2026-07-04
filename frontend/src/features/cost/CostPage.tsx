"use client";

import { useSearchParams } from "next/navigation";
import { BarChart3, CircleDollarSign, Moon, Sun, Zap } from "lucide-react";
import { FrostCard } from "@/components/shared/FrostCard";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { MetricGrid, StatCard } from "@/components/shared/StatCard";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import type { DeviceSummary, RoomSummary } from "@/features/api/types";
import { formatBdt, formatDate, formatKwh, formatWatts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUsageAnalytics } from "@/features/usage/useUsageAnalytics";
import { UsageFilters } from "@/features/usage/UsageFilters";

export function CostPage() {
  const { state, error } = useOfficeDataContext();
  const analytics = useUsageAnalytics();
  const searchParams = useSearchParams();
  const highlightRoom = searchParams.get("highlightRoom");

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  const totals = analytics.summary?.totals;
  const roomUsageById = new Map((analytics.roomUsage?.rooms ?? []).map((room) => [room.roomId, room]));
  const deviceUsageById = new Map((analytics.deviceUsage?.devices ?? []).map((device) => [device.deviceId, device]));
  const topDevices = [...state.devices]
    .map((device) => ({ device, usage: deviceUsageById.get(device.id) }))
    .sort((a, b) => (b.usage?.costBdt ?? b.device.costBdtToday) - (a.usage?.costBdt ?? a.device.costBdtToday))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Cost"
        description="Backend-calculated kWh, BDT, office-time, off-time, room, and device breakdowns."
      />

      <UsageFilters
        filters={analytics.filters}
        onChange={analytics.setFilters}
        rooms={state.rooms}
        devices={state.devices}
        onRefresh={() => void analytics.refresh()}
      />

      {analytics.error && <ErrorState message={analytics.error} />}
      {analytics.loading && !analytics.summary ? <LoadingState label="Loading cost analytics" /> : (
        <>
          <MetricGrid>
            <StatCard tone="energy" label="Range units" value={formatKwh(totals?.unitKwh)} helper={analytics.summary ? `${formatDate(analytics.summary.start)} to ${formatDate(analytics.summary.end)}` : "Selected range"} icon={Zap} />
            <StatCard tone="cost" label="Range cost" value={formatBdt(totals?.costBdt)} helper="Backend-calculated BDT" icon={CircleDollarSign} />
            <StatCard tone="info" label="Office-time cost" value={formatBdt(totals?.officeTimeCostBdt)} helper={formatKwh(totals?.officeTimeUnitKwh)} icon={Sun} />
            <StatCard tone={(totals?.offTimeCostBdt ?? 0) > 0 ? "warning" : "success"} label="Off-time cost" value={formatBdt(totals?.offTimeCostBdt)} helper={formatKwh(totals?.offTimeUnitKwh)} icon={Moon} />
            <StatCard tone="info" label="Average power" value={formatWatts(totals?.averagePowerWatts)} helper="For selected range" icon={BarChart3} />
          </MetricGrid>

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <SectionHeader title="Room cost breakdown" description="Room-wise cost, units, and current load." />
              <div className="mt-4 grid gap-3">
                {state.rooms.map((room) => (
                  <RoomCostRow
                    key={room.roomId}
                    room={room}
                    usage={roomUsageById.get(room.roomId)}
                    highlighted={highlightRoom === room.roomId}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionHeader title="Top consuming devices" description="Compact ranked device cost view." />
              <div className="mt-4 grid gap-3">
                {topDevices.map(({ device, usage }) => (
                  <DeviceCostRow
                    key={device.id}
                    device={device}
                    room={state.rooms.find((room) => room.roomId === device.roomId)}
                    usage={usage}
                  />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RoomCostRow({
  room,
  usage,
  highlighted
}: {
  room: RoomSummary;
  usage?: { unitKwh: number; costBdt: number; offTimeCostBdt: number; officeTimeCostBdt: number };
  highlighted: boolean;
}) {
  return (
    <FrostCard tone={highlighted ? "warning" : "default"} className={cn("rounded-lg p-4 transition", highlighted && "highlight-target")}>
      <div className="grid gap-3 md:grid-cols-[1fr_repeat(4,auto)] md:items-center">
        <div>
          <p className="font-semibold">{room.name}</p>
          <p className="text-sm text-muted-foreground">{room.activeDeviceCount}/{room.deviceCount} devices on</p>
        </div>
        <Metric label="Cost" value={formatBdt(usage?.costBdt ?? room.costBdtToday)} />
        <Metric label="kWh" value={formatKwh(usage?.unitKwh ?? room.unitKwhToday)} />
        <Metric label="Power" value={formatWatts(room.currentPowerWatts)} />
        <Metric label="Off-time" value={formatBdt(usage?.offTimeCostBdt ?? room.offTimeCostBdtToday)} />
      </div>
    </FrostCard>
  );
}

function DeviceCostRow({
  device,
  room,
  usage
}: {
  device: DeviceSummary;
  room?: RoomSummary;
  usage?: { unitKwh: number; costBdt: number };
}) {
  return (
    <FrostCard tone={device.status === "on" ? "energy" : "default"} className="rounded-lg p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{device.name}</p>
            <StatusBadge status={device.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{room?.name ?? "Unassigned room"}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-sm">
          <Metric label="Power" value={formatWatts(device.powerWatts)} />
          <Metric label="kWh" value={formatKwh(usage?.unitKwh ?? device.unitKwhToday)} />
          <Metric label="Cost" value={formatBdt(usage?.costBdt ?? device.costBdtToday)} />
        </div>
      </div>
    </FrostCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-nowrap text-sm font-semibold">{value}</p>
    </div>
  );
}
