"use client";

import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BellRing, Building2, CircleDollarSign, Cpu, RadioTower, TimerReset, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/shared/ChartCard";
import { DeviceCard, RoomCard } from "@/components/shared/DomainCards";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { MetricGrid, StatCard } from "@/components/shared/StatCard";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { formatBdt, formatDate, formatKwh, formatWatts } from "@/lib/format";
import { useUsageAnalytics } from "@/features/usage/useUsageAnalytics";

export function OverviewPage() {
  const { state, error } = useOfficeDataContext();
  const { timeline, roomUsage } = useUsageAnalytics();

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  const summary = state.officeSummary;
  const topDevices = [...state.devices].sort((a, b) => b.costBdtToday - a.costBdtToday).slice(0, 4);
  const topRooms = [...(roomUsage?.rooms ?? [])].sort((a, b) => b.costBdt - a.costBdt).slice(0, 5);
  const trendData = (timeline?.buckets ?? []).slice(-24).map((bucket) => ({
    label: formatDate(bucket.start),
    power: Number(bucket.averagePowerWatts.toFixed(2)),
    cost: Number(bucket.costBdt.toFixed(2))
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Executive overview"
        title="Live energy operations, without the data-wall noise."
        description="A focused view of office load, cost, off-time waste, room health, and alerts from the backend source of truth."
        actions={
          <>
            <Button asChild variant="outline"><Link href="/visualizer"><Building2 className="h-4 w-4" />Visualizer</Link></Button>
            <Button asChild><Link href="/usage"><Zap className="h-4 w-4" />Analyze usage</Link></Button>
          </>
        }
      />

      <MetricGrid>
        <StatCard label="Current load" value={formatWatts(summary.currentPowerWatts)} helper={`${summary.approxCurrentAmps} A live draw`} icon={Zap} />
        <StatCard label="Today units" value={formatKwh(summary.unitKwhToday)} helper={formatBdt(summary.costBdtToday)} icon={TimerReset} />
        <StatCard label="Today cost" value={formatBdt(summary.costBdtToday)} helper="Backend calculated" icon={CircleDollarSign} />
        <StatCard label="Monthly estimate" value={formatBdt(summary.estimatedMonthlyBillBdt)} helper={`${formatKwh(summary.unitKwhThisMonth)} this month`} icon={CircleDollarSign} />
        <StatCard label="Off-time cost" value={formatBdt(summary.offTimeCostBdtToday)} helper={formatKwh(summary.offTimeUnitKwhToday)} icon={AlertTriangle} tone={summary.offTimeCostBdtToday > 0 ? "warning" : "success"} />
        <StatCard label="Active alerts" value={String(state.activeAlerts.length)} helper={`${state.pendingNodes.length} pending nodes`} icon={BellRing} tone={state.activeAlerts.length ? "danger" : "success"} />
      </MetricGrid>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <ChartCard title="Energy trend" description="Average power by backend timeline bucket.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" minTickGap={26} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="power" name="Average W" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Operations snapshot</CardTitle>
            <CardDescription>Room nodes and inventory state.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <SnapshotItem icon={<Building2 className="h-4 w-4" />} label="Rooms" value={`${state.rooms.length} active`} />
            <SnapshotItem icon={<Cpu className="h-4 w-4" />} label="Devices" value={`${state.devices.filter((device) => device.status === "on").length}/${state.devices.length} on`} />
            <SnapshotItem icon={<RadioTower className="h-4 w-4" />} label="Nodes" value={`${state.nodes.filter((node) => node.status === "active").length}/${state.nodes.length} active`} />
            <SnapshotItem icon={<BellRing className="h-4 w-4" />} label="Alerts" value={`${state.activeAlerts.length} active`} />
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Rooms" description="A glanceable card per office area." actions={<Button asChild variant="outline"><Link href="/rooms">Manage rooms</Link></Button>} />
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {state.rooms.map((room) => {
            const alertCount = state.activeAlerts.filter((alert) => alert.roomId === room.roomId).length;
            return <RoomCard key={room.roomId} room={room} alertCount={alertCount} />;
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ChartCard title="Room cost comparison" description="Top backend room totals for the selected range.">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRooms.map((room) => ({
                name: state.rooms.find((item) => item.roomId === room.roomId)?.name ?? "Unassigned",
                cost: room.costBdt
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="cost" name="BDT" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Top consuming devices</CardTitle>
            <CardDescription>Ranked by backend-calculated cost today.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {topDevices.length === 0 ? <EmptyState title="No device usage yet" /> : topDevices.map((device) => <DeviceCard key={device.id} device={device} />)}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent alerts</CardTitle>
            <CardDescription>Active backend alerts that need attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.activeAlerts.length === 0 && <EmptyState title="No active alerts" description="The office is clear right now." />}
            {state.activeAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              </div>
            ))}
            {state.activeAlerts.length > 0 && <Button asChild variant="outline"><Link href="/alerts">Open alert center</Link></Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending ESP32 nodes</CardTitle>
            <CardDescription>Discovered room nodes waiting for assignment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.pendingNodes.length === 0 && <EmptyState title="No pending nodes" description="All discovered nodes are handled." />}
            {state.pendingNodes.slice(0, 4).map((node) => (
              <div key={node.nodeId} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{node.nodeId}</p>
                  <p className="text-sm text-muted-foreground">Sequence {node.lastSequence ?? "-"}</p>
                </div>
                <StatusBadge status={node.status} />
              </div>
            ))}
            {state.pendingNodes.length > 0 && <Button asChild variant="outline"><Link href="/nodes">Handle nodes</Link></Button>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SnapshotItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/25 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
