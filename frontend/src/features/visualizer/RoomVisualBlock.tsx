"use client";

import { AlertTriangle, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReusableSheet } from "@/components/shared/ReusableSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AlertSummary, DeviceSummary, NodeSummary, RoomSummary } from "@/features/api/types";
import { formatBdt, formatKwh, formatWatts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DeviceVisualIcon } from "./DeviceVisualIcon";

export function RoomVisualBlock({
  room,
  devices,
  node,
  alerts,
  className
}: {
  room: RoomSummary;
  devices: DeviceSummary[];
  node?: NodeSummary;
  alerts: AlertSummary[];
  className?: string;
}) {
  const activeAlerts = alerts.filter((alert) => alert.roomId === room.roomId || devices.some((device) => device.id === alert.deviceId));

  return (
    <ReusableSheet
      title={room.name}
      description="Room-level energy, office node, device, and alert state."
      trigger={
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "frost-card group relative flex min-h-[260px] flex-col rounded-xl p-4 text-left transition hover:bg-accent/40",
            activeAlerts.length > 0 && "border-warning/60",
            className
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{room.name}</p>
              <p className="text-sm text-muted-foreground">{devices.filter((device) => device.status === "on").length}/{devices.length} devices on</p>
            </div>
            {activeAlerts.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />{activeAlerts.length}
              </span>
            ) : (
              <StatusBadge status={node?.status ?? "unbound"} />
            )}
          </div>

          <div className="my-5 grid flex-1 grid-cols-3 place-items-center gap-3">
            {devices.map((device) => (
              <ReusableSheet
                key={device.id}
                title={device.name}
                description={device.externalDeviceId}
                trigger={
                  <span className="flex flex-col items-center gap-2 rounded-md p-2 transition hover:bg-muted">
                    <DeviceVisualIcon device={device} />
                    <span className="max-w-20 truncate text-xs text-muted-foreground">{device.name}</span>
                  </span>
                }
              >
                <DeviceDetail device={device} />
              </ReusableSheet>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-xs">
            <div><p className="text-muted-foreground">Power</p><p className="font-semibold">{formatWatts(room.currentPowerWatts)}</p></div>
            <div><p className="text-muted-foreground">Units</p><p className="font-semibold">{formatKwh(room.unitKwhToday)}</p></div>
            <div><p className="text-muted-foreground">Cost</p><p className="font-semibold">{formatBdt(room.costBdtToday)}</p></div>
          </div>
        </div>
      }
    >
      <RoomDetail room={room} devices={devices} node={node} alerts={activeAlerts} />
    </ReusableSheet>
  );
}

function RoomDetail({ room, devices, node, alerts }: { room: RoomSummary; devices: DeviceSummary[]; node?: NodeSummary; alerts: AlertSummary[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailMetric label="Power" value={formatWatts(room.currentPowerWatts)} />
        <DetailMetric label="Today cost" value={formatBdt(room.costBdtToday)} />
        <DetailMetric label="Today units" value={formatKwh(room.unitKwhToday)} />
        <DetailMetric label="Off-time cost" value={formatBdt(room.offTimeCostBdtToday)} />
      </div>
      <div className="rounded-xl border p-4">
        <p className="mb-3 flex items-center gap-2 font-medium"><Cpu className="h-4 w-4 text-muted-foreground" />Office node</p>
        <p className="text-sm text-muted-foreground">{node ? "Connected to this room" : "No office node assigned"}</p>
        {node && <div className="mt-3"><StatusBadge status={node.status} /></div>}
      </div>
      <div className="space-y-3">
        <p className="font-medium">Devices</p>
        {devices.map((device) => <DeviceDetail key={device.id} device={device} compact />)}
      </div>
      {alerts.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium">Room alerts</p>
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-warning/40 bg-warning/10 p-3">
              <p className="font-medium">{alert.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceDetail({ device, compact }: { device: DeviceSummary; compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", compact && "p-3")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{device.name}</p>
          <p className="text-sm text-muted-foreground">{device.externalDeviceId}</p>
        </div>
        <StatusBadge status={device.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <DetailMetric label="Power" value={formatWatts(device.powerWatts)} />
        <DetailMetric label="Cost" value={formatBdt(device.costBdtToday)} />
        <DetailMetric label="Voltage" value={`${device.voltageVolts} V`} />
        <DetailMetric label="Current" value={`${device.currentAmps} A`} />
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
