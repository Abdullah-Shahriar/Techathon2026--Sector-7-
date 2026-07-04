"use client";

import { Cpu } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FrostCard } from "@/components/shared/FrostCard";
import { ReusableSheet } from "@/components/shared/ReusableSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeviceManagementActions } from "@/features/devices/DeviceManagementActions";
import type { DeviceSummary, ManagedDevice, ManagedRoom } from "@/features/api/types";
import { formatBdt, formatKwh, formatWatts } from "@/lib/format";

export function DeviceSettingsTab({
  managedDevices,
  managedRooms,
  liveDevices,
  onDone
}: {
  managedDevices: ManagedDevice[];
  managedRooms: ManagedRoom[];
  liveDevices: DeviceSummary[];
  onDone: () => Promise<void>;
}) {
  const liveById = new Map(liveDevices.map((device) => [device.id, device]));

  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {managedDevices.map((device) => {
        const live = liveById.get(device._id);
        return (
          <ReusableSheet
            key={device._id}
            title={device.name}
            description="Device catalog settings and room assignment."
            trigger={<button className="text-left"><DeviceSettingsCard device={device} live={live} rooms={managedRooms} /></button>}
          >
            <DeviceManagementActions device={device} rooms={managedRooms} onDone={onDone} />
          </ReusableSheet>
        );
      })}
    </section>
  );
}

function DeviceSettingsCard({ device, live, rooms }: { device: ManagedDevice; live?: DeviceSummary; rooms: ManagedRoom[] }) {
  const roomName = rooms.find((room) => room._id === device.roomId)?.name ?? "Unassigned";
  return (
    <FrostCard tone={live?.status === "on" ? "energy" : "default"} className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              {device.name}
            </CardTitle>
            <CardDescription>{roomName} / {device.type}</CardDescription>
          </div>
          <StatusBadge status={device.isActive === false ? "archived" : live?.status ?? "active"} />
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Expected watts" value={device.expectedPowerWatts === null || device.expectedPowerWatts === undefined ? "Unset" : formatWatts(device.expectedPowerWatts)} />
        <Metric label="Current power" value={live ? formatWatts(live.powerWatts) : "0 W"} />
        <Metric label="Today cost" value={live ? formatBdt(live.costBdtToday) : "BDT 0"} />
        <Metric label="Today kWh" value={live ? formatKwh(live.unitKwhToday) : "0 kWh"} />
      </CardContent>
    </FrostCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
