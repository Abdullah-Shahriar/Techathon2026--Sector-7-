"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Cpu, Filter, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { DeviceCard } from "@/components/shared/DomainCards";
import { FrostCard } from "@/components/shared/FrostCard";
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
  const searchParams = useSearchParams();
  const highlightDevice = searchParams.get("highlightDevice");
  const [roomFilter, setRoomFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  useEffect(() => {
    const stored = window.localStorage.getItem("officepulse:device-view");
    if (stored === "cards" || stored === "list") {
      setViewMode(stored);
      return;
    }
    setViewMode(window.matchMedia("(min-width: 768px)").matches ? "list" : "cards");
  }, []);

  function chooseView(mode: "cards" | "list") {
    setViewMode(mode);
    window.localStorage.setItem("officepulse:device-view", mode);
  }

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
        actions={
          <div className="frost-card flex rounded-md p-1">
            <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="sm" onClick={() => chooseView("cards")}>
              <LayoutGrid className="h-4 w-4" />Cards
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => chooseView("list")}>
              <List className="h-4 w-4" />List
            </Button>
          </div>
        }
      />

      <Card className="frost-card">
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
        <SectionHeader title={viewMode === "cards" ? "Device cards" : "Device list"} description={`${visibleDevices.length} matching devices`} />
        {viewMode === "list" ? (
          <div className="mt-4">
            <DataTable
              columns={["Device", "Room", "State", "Power", "Usage", "Last changed", ""]}
              rowClasses={visibleDevices.map((device) => highlightDevice === device._id ? "highlight-target bg-warning/10" : "")}
              rows={visibleDevices.map((device) => {
                const live = liveById.get(device._id);
                return [
                  <DeviceTitle key="title" device={device} />,
                  activeRooms.find((room) => room._id === device.roomId)?.name ?? "Unassigned",
                  <StatusBadge key="state" status={device.isActive === false ? "archived" : live?.status ?? "inactive"} />,
                  live ? formatWatts(live.powerWatts) : "0 W",
                  live ? `${formatKwh(live.unitKwhToday)} / ${formatBdt(live.costBdtToday)}` : "No usage",
                  live ? formatDate(live.lastChangedAt) : "Never",
                  <DeviceSheet
                    key="manage"
                    managedDevice={device}
                    liveDevice={live}
                    rooms={activeRooms}
                    onDone={refresh}
                    trigger={<Button variant="outline" size="sm">Manage</Button>}
                  />
                ];
              })}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleDevices.map((device) => {
              const live = liveById.get(device._id);
              return (
                <div key={device._id} className={highlightDevice === device._id ? "highlight-target rounded-xl" : ""}>
                  <DeviceSheet managedDevice={device} liveDevice={live} rooms={activeRooms} onDone={refresh} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DeviceSheet({
  managedDevice,
  liveDevice,
  rooms,
  onDone,
  trigger
}: {
  managedDevice: ManagedDevice;
  liveDevice?: DeviceSummary;
  rooms: ManagedRoom[];
  onDone: () => Promise<void>;
  trigger?: React.ReactNode;
}) {
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
      description={managedDevice.externalDeviceId}
      trigger={trigger ?? <div><DeviceCard device={displayDevice} /></div>}
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
    <FrostCard className="rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </FrostCard>
  );
}
