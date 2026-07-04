"use client";

import { useMemo, useState } from "react";
import { Cpu, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { ResponsiveTableOrCards } from "@/components/shared/DataTable";
import { DeviceCard } from "@/components/shared/DomainCards";
import { ReusableSheet } from "@/components/shared/ReusableSheet";
import { SelectField } from "@/components/shared/FormField";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import type { DeviceSummary, ManagedDevice, ManagedRoom } from "@/features/api/types";
import { formatBdt, formatDate, formatDuration, formatKwh, formatWatts } from "@/lib/format";
import { DeviceManagementActions } from "./DeviceManagementActions";

export function DevicesPage() {
  const { state, managedDevices, managedRooms, error, refresh } = useOfficeDataContext();
  const [roomFilter, setRoomFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const liveById = useMemo(() => new Map((state?.devices ?? []).map((device) => [device.id, device])), [state?.devices]);
  const activeRooms = useMemo(() => managedRooms.filter((room) => room.isActive !== false), [managedRooms]);
  const visibleDevices = useMemo(() => managedDevices.filter((device) => {
    const live = liveById.get(device._id);
    if (roomFilter !== "all" && (device.roomId ?? "none") !== roomFilter) return false;
    if (typeFilter !== "all" && device.type !== typeFilter) return false;
    if (statusFilter === "archived" && device.isActive !== false) return false;
    if (statusFilter === "on" && live?.status !== "on") return false;
    if (statusFilter === "off" && live?.status !== "off") return false;
    if (statusFilter === "active" && device.isActive === false) return false;
    return true;
  }), [managedDevices, liveById, roomFilter, typeFilter, statusFilter]);

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventory"
        title="Devices"
        description="Filter, inspect, rename, move, archive, or restore devices."
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Filter className="h-4 w-4" />Filters</div>
          <SelectField
            label="Room"
            value={roomFilter}
            onValueChange={setRoomFilter}
            options={[{ value: "all", label: "All rooms" }, { value: "none", label: "Unassigned" }, ...activeRooms.map((room) => ({ value: room._id, label: room.name }))]}
          />
          <SelectField
            label="Type"
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[{ value: "all", label: "All types" }, { value: "fan", label: "Fans" }, { value: "light", label: "Lights" }, { value: "other", label: "Other" }]}
          />
          <SelectField
            label="Status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[{ value: "all", label: "All" }, { value: "active", label: "Active inventory" }, { value: "on", label: "On now" }, { value: "off", label: "Off now" }, { value: "archived", label: "Archived" }]}
          />
        </CardContent>
      </Card>

      <section>
        <SectionHeader title="Device list" description={`${visibleDevices.length} matching devices`} />
        <ResponsiveTableOrCards
          columns={["Device", "Room", "State", "Power", "Usage", "Last changed"]}
          rows={visibleDevices.map((device) => {
            const live = liveById.get(device._id);
            return [
              <DeviceTitle key="title" device={device} />,
              activeRooms.find((room) => room._id === device.roomId)?.name ?? "Unassigned",
              <StatusBadge key="state" status={device.isActive === false ? "archived" : live?.status ?? "inactive"} />,
              live ? formatWatts(live.powerWatts) : "0 W",
              live ? `${formatKwh(live.unitKwhToday)} / ${formatBdt(live.costBdtToday)}` : "No usage",
              live ? formatDate(live.lastChangedAt) : "Never"
            ];
          })}
          cards={visibleDevices.map((device) => {
            const live = liveById.get(device._id);
            return <DeviceSheet key={device._id} managedDevice={device} liveDevice={live} rooms={activeRooms} onDone={refresh} />;
          })}
        />
        <div className="mt-4 hidden grid-cols-2 gap-4 md:grid xl:grid-cols-3">
          {visibleDevices.map((device) => {
            const live = liveById.get(device._id);
            return <DeviceSheet key={device._id} managedDevice={device} liveDevice={live} rooms={activeRooms} onDone={refresh} />;
          })}
        </div>
      </section>
    </div>
  );
}

function DeviceSheet({ managedDevice, liveDevice, rooms, onDone }: { managedDevice: ManagedDevice; liveDevice?: DeviceSummary; rooms: ManagedRoom[]; onDone: () => Promise<void> }) {
  const displayDevice = liveDevice ?? {
    id: managedDevice._id,
    externalDeviceId: managedDevice.externalDeviceId,
    name: managedDevice.name,
    type: managedDevice.type,
    roomId: managedDevice.roomId,
    nodeId: managedDevice.nodeId,
    status: "off" as const,
    voltageVolts: 0,
    currentAmps: 0,
    powerWatts: 0,
    expectedPowerWatts: managedDevice.expectedPowerWatts,
    unitKwhToday: 0,
    costBdtToday: 0,
    officeTimeUnitKwhToday: 0,
    officeTimeCostBdtToday: 0,
    offTimeUnitKwhToday: 0,
    offTimeCostBdtToday: 0,
    lastChangedAt: null,
    onSince: null,
    onDurationSeconds: 0
  };

  return (
    <ReusableSheet
      title={managedDevice.name}
      description={`${managedDevice.externalDeviceId} / ${managedDevice.nodeId}`}
      trigger={<div><DeviceCard device={displayDevice} /></div>}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Power" value={formatWatts(displayDevice.powerWatts)} />
          <Metric label="Cost" value={formatBdt(displayDevice.costBdtToday)} />
          <Metric label="Usage" value={formatKwh(displayDevice.unitKwhToday)} />
          <Metric label="On duration" value={formatDuration(displayDevice.onDurationSeconds)} />
        </div>
        <DeviceManagementActions device={managedDevice} rooms={rooms} onDone={onDone} />
      </div>
    </ReusableSheet>
  );
}

function DeviceTitle({ device }: { device: ManagedDevice }) {
  return (
    <div className="flex items-center gap-2">
      <Cpu className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="font-medium">{device.name}</p>
        <p className="text-xs text-muted-foreground">{device.externalDeviceId}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
