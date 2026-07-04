"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/features/api/client";
import type { DeviceUsageResponse, RoomUsageResponse, TimelineResponse, UsageFilters, UsageSummaryResponse } from "@/features/api/types";

export const defaultUsageFilters: UsageFilters = {
  range: "today",
  start: "",
  end: "",
  groupBy: "hour",
  intervalSeconds: 3600,
  roomId: "",
  deviceId: ""
};

export function useUsageAnalytics(initialFilters: UsageFilters = defaultUsageFilters) {
  const [filters, setFilters] = useState<UsageFilters>(initialFilters);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [roomUsage, setRoomUsage] = useState<RoomUsageResponse | null>(null);
  const [deviceUsage, setDeviceUsage] = useState<DeviceUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, timelineData, roomsData, devicesData] = await Promise.all([
        api.usageSummary(filters),
        api.timeline(filters),
        api.roomUsage(filters),
        api.deviceUsage(filters)
      ]);
      setSummary(summaryData);
      setTimeline(timelineData);
      setRoomUsage(roomsData);
      setDeviceUsage(devicesData);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { filters, setFilters, summary, timeline, roomUsage, deviceUsage, loading, error, refresh };
}
