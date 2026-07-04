"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/shared/ChartCard";
import type { DeviceUsageResponse, RoomSummary, RoomUsageResponse, TimelineResponse } from "@/features/api/types";
import { formatDate } from "@/lib/format";

export function UsageTimelineChart({ timeline }: { timeline: TimelineResponse | null }) {
  const data = (timeline?.buckets ?? []).map((bucket) => ({
    label: formatDate(bucket.start),
    power: Number(bucket.averagePowerWatts.toFixed(3)),
    cost: Number(bucket.costBdt.toFixed(2)),
    kwh: Number(bucket.unitKwh.toFixed(6))
  }));

  return (
    <ChartCard title="Timeline" description="Backend timeline buckets for the selected range.">
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" minTickGap={28} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Area type="monotone" dataKey="power" name="Average W" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function RoomComparisonChart({ usage, rooms }: { usage: RoomUsageResponse | null; rooms: RoomSummary[] }) {
  const data = (usage?.rooms ?? []).map((room) => ({
    name: rooms.find((item) => item.roomId === room.roomId)?.name ?? "Unassigned",
    cost: room.costBdt,
    kwh: room.unitKwh
  }));

  return (
    <ChartCard title="Room comparison" description="Cost by room for the selected range.">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Bar dataKey="cost" name="BDT" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function DeviceComparisonChart({ usage }: { usage: DeviceUsageResponse | null }) {
  const data = (usage?.devices ?? []).slice(0, 12).map((device) => ({
    name: device.deviceId.slice(-6),
    cost: device.costBdt,
    kwh: device.unitKwh
  }));

  return (
    <ChartCard title="Device comparison" description="Top device cost buckets for the selected range.">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Bar dataKey="cost" name="BDT" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
