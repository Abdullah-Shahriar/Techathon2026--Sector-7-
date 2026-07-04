import { Cpu, DoorOpen, RadioTower } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DeviceSummary, NodeSummary, RoomSummary } from "@/features/api/types";
import { formatBdt, formatDate, formatKwh, formatWatts } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function RoomCard({ room, alertCount = 0, onClick }: { room: RoomSummary; alertCount?: number; onClick?: () => void }) {
  return (
    <Card className="cursor-pointer transition hover:bg-accent/40" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold"><DoorOpen className="h-4 w-4 text-muted-foreground" />{room.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{room.activeDeviceCount}/{room.deviceCount} devices active</p>
          </div>
          <StatusBadge status={alertCount > 0 ? "warning" : "active"} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Power</p><p className="font-semibold">{formatWatts(room.currentPowerWatts)}</p></div>
          <div><p className="text-muted-foreground">Today</p><p className="font-semibold">{formatBdt(room.costBdtToday)}</p></div>
          <div><p className="text-muted-foreground">Units</p><p className="font-semibold">{formatKwh(room.unitKwhToday)}</p></div>
          <div><p className="text-muted-foreground">Off-time</p><p className="font-semibold">{formatBdt(room.offTimeCostBdtToday)}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DeviceCard({ device, onClick }: { device: DeviceSummary; onClick?: () => void }) {
  return (
    <Card className="cursor-pointer transition hover:bg-accent/40" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold"><Cpu className="h-4 w-4 text-muted-foreground" />{device.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{device.externalDeviceId}</p>
          </div>
          <StatusBadge status={device.status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Power</p><p className="font-semibold">{formatWatts(device.powerWatts)}</p></div>
          <div><p className="text-muted-foreground">Cost</p><p className="font-semibold">{formatBdt(device.costBdtToday)}</p></div>
          <div><p className="text-muted-foreground">Status</p><p className="font-semibold capitalize">{device.status}</p></div>
          <div><p className="text-muted-foreground">Usage</p><p className="font-semibold">{formatKwh(device.unitKwhToday)}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NodeCard({ node, children }: { node: NodeSummary; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold"><RadioTower className="h-4 w-4 text-muted-foreground" />{node.nodeId}</p>
            <p className="mt-1 text-sm text-muted-foreground">Last seen {formatDate(node.lastSeenAt)}</p>
          </div>
          <StatusBadge status={node.status} />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">Sequence {node.lastSequence ?? "-"}</div>
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}
