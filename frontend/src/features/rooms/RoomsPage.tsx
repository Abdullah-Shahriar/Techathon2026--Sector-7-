"use client";

import { DoorOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { RoomCard } from "@/components/shared/DomainCards";
import { ReusableSheet } from "@/components/shared/ReusableSheet";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import type { ManagedRoom, RoomSummary } from "@/features/api/types";
import { formatBdt, formatKwh, formatWatts } from "@/lib/format";
import { RoomManagementActions } from "./RoomManagementActions";

export function RoomsPage() {
  const { state, managedRooms, error, refresh } = useOfficeDataContext();

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  const activeRoomIds = new Set(state.rooms.map((room) => room.roomId));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Room operations"
        title="Manage rooms as office assets, not database rows."
        description="Review live room load, cost, devices, and node status. Rename, archive, or restore rooms through backend APIs."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {managedRooms.map((managedRoom) => {
          const roomSummary = state.rooms.find((room) => room.roomId === managedRoom._id);
          return (
            <RoomSheet
              key={managedRoom._id}
              managedRoom={managedRoom}
              summary={roomSummary}
              archived={!activeRoomIds.has(managedRoom._id)}
              onDone={refresh}
            />
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Room analytics</CardTitle>
          <CardDescription>Backend-calculated daily room totals.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.rooms.map((room) => (
            <div key={room.roomId} className="rounded-lg border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-semibold">{room.name}</p>
                <DoorOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Power" value={formatWatts(room.currentPowerWatts)} />
                <Metric label="Cost" value={formatBdt(room.costBdtToday)} />
                <Metric label="Units" value={formatKwh(room.unitKwhToday)} />
                <Metric label="Off-time" value={formatBdt(room.offTimeCostBdtToday)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RoomSheet({
  managedRoom,
  summary,
  archived,
  onDone
}: {
  managedRoom: ManagedRoom;
  summary?: RoomSummary;
  archived: boolean;
  onDone: () => Promise<void>;
}) {
  return (
    <ReusableSheet
      title={managedRoom.name}
      description="Room details and management actions."
      trigger={
        summary ? (
          <div><RoomCard room={summary} /></div>
        ) : (
          <Card className="cursor-pointer border-dashed transition hover:border-primary/40">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{managedRoom.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Archived room</p>
                </div>
                <StatusBadge status="archived" />
              </div>
            </CardContent>
          </Card>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Status" value={archived ? "Archived" : "Active"} />
          <Metric label="Power" value={summary ? formatWatts(summary.currentPowerWatts) : "0 W"} />
          <Metric label="Today usage" value={summary ? formatKwh(summary.unitKwhToday) : "0 kWh"} />
          <Metric label="Today cost" value={summary ? formatBdt(summary.costBdtToday) : "BDT 0.00"} />
        </div>
        <RoomManagementActions room={managedRoom} onDone={onDone} />
      </div>
    </ReusableSheet>
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
