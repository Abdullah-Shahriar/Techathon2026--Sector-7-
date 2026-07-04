"use client";

import { BarChart3, Clock, CircleDollarSign, Moon, Sun, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricGrid, StatCard } from "@/components/shared/StatCard";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { formatBdt, formatDate, formatKwh, formatWatts } from "@/lib/format";
import { useUsageAnalytics } from "./useUsageAnalytics";
import { UsageFilters } from "./UsageFilters";
import { DeviceComparisonChart, RoomComparisonChart, UsageTimelineChart } from "./UsageTimelineChart";

export function UsagePage() {
  const { state, error } = useOfficeDataContext();
  const analytics = useUsageAnalytics();

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  const totals = analytics.summary?.totals;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Usage"
        description="Cost, energy, office-time, and off-time totals."
      />
      <UsageFilters
        filters={analytics.filters}
        onChange={analytics.setFilters}
        rooms={state.rooms}
        devices={state.devices}
        onRefresh={() => void analytics.refresh()}
      />
      {analytics.error && <ErrorState message={analytics.error} />}
      {analytics.loading && !analytics.summary ? <LoadingState label="Loading usage analytics" /> : (
        <>
          <MetricGrid>
            <StatCard label="Range units" value={formatKwh(totals?.unitKwh)} helper={analytics.summary ? `${formatDate(analytics.summary.start)} to ${formatDate(analytics.summary.end)}` : "Selected range"} icon={Zap} />
            <StatCard label="Range cost" value={formatBdt(totals?.costBdt)} helper="Backend-calculated BDT" icon={CircleDollarSign} />
            <StatCard label="Office-time units" value={formatKwh(totals?.officeTimeUnitKwh)} helper={formatBdt(totals?.officeTimeCostBdt)} icon={Sun} />
            <StatCard label="Off-time units" value={formatKwh(totals?.offTimeUnitKwh)} helper={formatBdt(totals?.offTimeCostBdt)} icon={Moon} tone={(totals?.offTimeCostBdt ?? 0) > 0 ? "warning" : "success"} />
            <StatCard label="Average power" value={formatWatts(totals?.averagePowerWatts)} helper={`${totals?.averageCurrentAmps ?? 0} A average`} icon={BarChart3} />
            <StatCard label="Grouping" value={analytics.filters.groupBy} helper={analytics.filters.groupBy === "custom" ? `${analytics.filters.intervalSeconds}s buckets` : "Calendar or fixed buckets"} icon={Clock} />
          </MetricGrid>
          <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
            <UsageTimelineChart timeline={analytics.timeline} />
            <RoomComparisonChart usage={analytics.roomUsage} rooms={state.rooms} />
          </section>
          <DeviceComparisonChart usage={analytics.deviceUsage} />
        </>
      )}
    </div>
  );
}
