"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CircleDollarSign, Cpu, Grid3X3, LayoutDashboard, PlugZap, TimerReset, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { FrostCard } from "@/components/shared/FrostCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { MetricGrid, StatCard } from "@/components/shared/StatCard";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import type { DeviceSummary, RoomSummary, TimelineResponse } from "@/features/api/types";
import { OfficeFloorPlan } from "@/features/visualizer/OfficeFloorPlan";
import { useUsageAnalytics } from "@/features/usage/useUsageAnalytics";
import { formatBdt, formatDate, formatKwh, formatWatts } from "@/lib/format";

export function OverviewPage() {
  const { state, error } = useOfficeDataContext();
  const { timeline } = useUsageAnalytics();
  const [viewMode, setViewMode] = useState<"overview" | "visualizer">("overview");

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  const summary = state.officeSummary;
  const topDevices = [...state.devices].sort((a, b) => b.costBdtToday - a.costBdtToday).slice(0, 5);
  const pendingNodes = state.pendingNodes.length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Dashboard"
        title={viewMode === "overview" ? "Energy overview" : "Office visualizer"}
        description={viewMode === "overview" ? "A cleaner live view for load, units, cost, and waste." : "Graphical room and device state from backend data."}
        actions={
          <div className="frost-card flex rounded-md p-1">
            <Button variant={viewMode === "overview" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("overview")}>
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </Button>
            <Button variant={viewMode === "visualizer" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("visualizer")}>
              <Grid3X3 className="h-4 w-4" />
              Visualizer
            </Button>
          </div>
        }
      />

      {viewMode === "visualizer" ? (
        <OfficeFloorPlan rooms={state.rooms} devices={state.devices} nodes={state.nodes} alerts={state.activeAlerts} />
      ) : (
        <>
          {pendingNodes > 0 && (
            <FrostCard tone="warning" className="rounded-lg p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-background/60">
                    <PlugZap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {pendingNodes} device node{pendingNodes === 1 ? " is" : "s are"} waiting to be connected.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pair them to rooms in Settings so the dashboard can organize incoming telemetry.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-background/80 text-foreground hover:bg-background">
                    <Link href="/settings?section=device-nodes">Connect all</Link>
                  </Button>
                  <Button asChild variant="outline" className="bg-background/60">
                    <Link href="/settings?section=device-nodes">Manage</Link>
                  </Button>
                </div>
              </div>
            </FrostCard>
          )}

          <MetricGrid>
            <StatCard tone="energy" label="Current load" value={formatWatts(summary.currentPowerWatts)} helper={`${state.devices.filter((device) => device.status === "on").length}/${state.devices.length} devices on`} icon={Zap} />
            <StatCard tone="info" label="Today units" value={formatKwh(summary.unitKwhToday)} helper="Backend-calculated kWh" icon={TimerReset} />
            <StatCard tone="cost" label="Today cost" value={formatBdt(summary.costBdtToday)} helper="Backend-calculated BDT" icon={CircleDollarSign} />
            <StatCard tone="cost" label="Month-to-date cost" value={formatBdt(summary.costBdtThisMonth)} helper={formatKwh(summary.unitKwhThisMonth)} icon={CircleDollarSign} />
            <StatCard tone={summary.offTimeCostBdtToday > 0 ? "warning" : "success"} label="Off-time cost" value={formatBdt(summary.offTimeCostBdtToday)} helper={formatKwh(summary.offTimeUnitKwhToday)} icon={PlugZap} />
          </MetricGrid>

          <TodayTrendChart timeline={timeline} />

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <FrostCard tone="info" className="rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-background/70">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium uppercase text-muted-foreground">Office state</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-normal">{formatWatts(summary.currentPowerWatts)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {state.rooms.length} rooms are reporting through the backend. Cost and energy numbers shown here are display-only frontend formatting of backend-calculated values.
                  </p>
                  <Button asChild variant="outline" className="mt-4 bg-background/60">
                    <Link href="/cost">Open cost breakdown</Link>
                  </Button>
                </div>
              </div>
            </FrostCard>

            <div>
              <SectionHeader title="Top consuming devices" description="Compact today view ranked by cost." />
              <div className="mt-4 grid gap-3">
                {topDevices.length === 0 ? (
                  <EmptyState title="No device usage yet" />
                ) : (
                  topDevices.map((device) => (
                    <TopDeviceRow
                      key={device.id}
                      device={device}
                      room={state.rooms.find((room) => room.roomId === device.roomId)}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TodayTrendChart({ timeline }: { timeline: TimelineResponse | null }) {
  const data = (timeline?.buckets ?? []).slice(-12).map((bucket) => ({
    label: formatDate(bucket.start),
    cost: Number(bucket.costBdt.toFixed(2)),
    kwh: Number(bucket.unitKwh.toFixed(6))
  }));

  return (
    <FrostCard className="rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Today cost and usage trend</h3>
        <p className="mt-1 text-sm text-muted-foreground">Backend timeline buckets for the current day.</p>
      </div>
      {data.length === 0 ? (
        <EmptyState title="No timeline yet" description="Usage trend appears after backend records are available." />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" minTickGap={24} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="cost" name="Cost BDT" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.18)" strokeWidth={2} />
              <Area type="monotone" dataKey="kwh" name="kWh" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.12)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </FrostCard>
  );
}

function TopDeviceRow({ device, room }: { device: DeviceSummary; room?: RoomSummary }) {
  return (
    <FrostCard tone={device.status === "on" ? "energy" : "default"} className="rounded-lg p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <p className="truncate font-semibold">{device.name}</p>
            <StatusBadge status={device.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{room?.name ?? "Unassigned room"}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-sm">
          <Metric label="Power" value={formatWatts(device.powerWatts)} />
          <Metric label="kWh" value={formatKwh(device.unitKwhToday)} />
          <Metric label="Cost" value={formatBdt(device.costBdtToday)} />
        </div>
      </div>
    </FrostCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-nowrap font-semibold">{value}</p>
    </div>
  );
}
