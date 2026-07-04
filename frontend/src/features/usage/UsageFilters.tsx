"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { NumberInputField, SelectField } from "@/components/shared/FormField";
import type { DeviceSummary, RoomSummary, UsageFilters as UsageFiltersType } from "@/features/api/types";

const ranges = ["today", "yesterday", "this_week", "last_7_days", "this_month", "last_30_days", "this_year", "custom"];
const groups = ["second", "minute", "hour", "day", "week", "month", "year", "custom"];

export function UsageFilters({
  filters,
  onChange,
  rooms,
  devices,
  onRefresh
}: {
  filters: UsageFiltersType;
  onChange: (filters: UsageFiltersType) => void;
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-4">
        <SelectField
          label="Range"
          value={filters.range}
          onValueChange={(range) => onChange({ ...filters, range })}
          options={ranges.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
        />
        <SelectField
          label="Group by"
          value={filters.groupBy}
          onValueChange={(groupBy) => onChange({ ...filters, groupBy })}
          options={groups.map((value) => ({ value, label: value }))}
        />
        <NumberInputField
          label="Custom interval seconds"
          min={1}
          value={filters.intervalSeconds}
          onChange={(event) => onChange({ ...filters, intervalSeconds: Math.max(1, Number(event.target.value) || 1) })}
        />
        <div className="flex items-end">
          <Button className="w-full" onClick={onRefresh}><RefreshCw className="h-4 w-4" />Refresh</Button>
        </div>
        <div className="lg:col-span-2">
          <DateRangePicker filters={filters} onChange={onChange} />
        </div>
        <SelectField
          label="Room"
          value={filters.roomId || "all"}
          onValueChange={(roomId) => onChange({ ...filters, roomId: roomId === "all" ? "" : roomId })}
          options={[{ value: "all", label: "All rooms" }, ...rooms.map((room) => ({ value: room.roomId, label: room.name }))]}
        />
        <SelectField
          label="Device"
          value={filters.deviceId || "all"}
          onValueChange={(deviceId) => onChange({ ...filters, deviceId: deviceId === "all" ? "" : deviceId })}
          options={[{ value: "all", label: "All devices" }, ...devices.map((device) => ({ value: device.id, label: `${device.name} (${device.externalDeviceId})` }))]}
        />
      </CardContent>
    </Card>
  );
}
