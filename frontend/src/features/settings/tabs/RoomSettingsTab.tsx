"use client";

import { DoorOpen } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FrostCard } from "@/components/shared/FrostCard";
import { ReusableSheet } from "@/components/shared/ReusableSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoomManagementActions } from "@/features/rooms/RoomManagementActions";
import type { ManagedRoom, RoomSummary } from "@/features/api/types";
import { formatBdt, formatKwh, formatWatts } from "@/lib/format";

export function RoomSettingsTab({
  managedRooms,
  rooms,
  onDone
}: {
  managedRooms: ManagedRoom[];
  rooms: RoomSummary[];
  onDone: () => Promise<void>;
}) {
  const liveById = new Map(rooms.map((room) => [room.roomId, room]));

  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {managedRooms.map((room) => {
        const live = liveById.get(room._id);
        return (
          <ReusableSheet
            key={room._id}
            title={room.name}
            description="Room settings and management actions."
            trigger={<button className="text-left"><RoomSettingsCard room={room} live={live} /></button>}
          >
            <RoomManagementActions room={room} onDone={onDone} />
          </ReusableSheet>
        );
      })}
    </section>
  );
}

function RoomSettingsCard({ room, live }: { room: ManagedRoom; live?: RoomSummary }) {
  return (
    <FrostCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-muted-foreground" />
              {room.name}
            </CardTitle>
            <CardDescription>{room.isActive === false ? "Archived room" : "Room settings"}</CardDescription>
          </div>
          <StatusBadge status={room.isActive === false ? "archived" : "active"} />
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Power" value={live ? formatWatts(live.currentPowerWatts) : "0 W"} />
        <Metric label="Cost" value={live ? formatBdt(live.costBdtToday) : "BDT 0"} />
        <Metric label="kWh" value={live ? formatKwh(live.unitKwhToday) : "0 kWh"} />
        <Metric label="Devices" value={live ? `${live.activeDeviceCount}/${live.deviceCount} on` : "No live data"} />
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
