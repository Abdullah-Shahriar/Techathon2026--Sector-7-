import type { AlertSummary, DeviceSummary, NodeSummary, RoomSummary } from "@/features/api/types";
import { RoomVisualBlock } from "./RoomVisualBlock";

export function OfficeFloorPlan({
  rooms,
  devices,
  nodes,
  alerts
}: {
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  nodes: NodeSummary[];
  alerts: AlertSummary[];
}) {
  return (
    <div className="frost-card rounded-xl p-4 shadow-sm">
      <div className="grid min-h-[640px] gap-4 lg:grid-cols-3 lg:grid-rows-[1.1fr_0.9fr]">
        {rooms.map((room, index) => (
          <RoomVisualBlock
            key={room.roomId}
            room={room}
            devices={devices.filter((device) => device.roomId === room.roomId)}
            node={nodes.find((node) => node.roomId === room.roomId)}
            alerts={alerts}
            className={index === 0 ? "lg:row-span-2" : index === 1 ? "lg:col-span-2" : "lg:col-span-2"}
          />
        ))}
        {devices.some((device) => !device.roomId) && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4">
            <p className="font-semibold">Unassigned devices</p>
            <p className="mt-1 text-sm text-muted-foreground">{devices.filter((device) => !device.roomId).length} devices need room mapping.</p>
          </div>
        )}
      </div>
    </div>
  );
}
