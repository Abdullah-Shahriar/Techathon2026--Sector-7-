"use client";

import { FormEvent, useState } from "react";
import { Archive, Link2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextInputField, NumberInputField } from "@/components/shared/FormField";
import { apiPatch, apiPost } from "@/features/api/client";
import type { ManagedDevice, ManagedRoom } from "@/features/api/types";

export function DeviceManagementActions({
  device,
  rooms,
  onDone
}: {
  device: ManagedDevice;
  rooms: ManagedRoom[];
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState(device.name);
  const [type, setType] = useState(device.type || "other");
  const [expectedPowerWatts, setExpectedPowerWatts] = useState(device.expectedPowerWatts === null || device.expectedPowerWatts === undefined ? "" : String(device.expectedPowerWatts));
  const [roomId, setRoomId] = useState(device.roomId ?? "none");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(() => apiPatch(`/api/devices/${device._id}`, {
      name,
      type,
      expectedPowerWatts: expectedPowerWatts.trim() ? Number(expectedPowerWatts) : null
    }));
  }

  return (
    <div className="space-y-5">
      <form className="grid gap-3" onSubmit={submit}>
        <TextInputField label="Device name" value={name} onChange={(event) => setName(event.target.value)} />
        <SelectField
          label="Device type"
          value={type}
          onValueChange={setType}
          options={[
            { value: "fan", label: "Fan" },
            { value: "light", label: "Light" },
            { value: "other", label: "Other" }
          ]}
        />
        <NumberInputField label="Expected watts" min={0} value={expectedPowerWatts} onChange={(event) => setExpectedPowerWatts(event.target.value)} />
        <Button disabled={busy}><Save className="h-4 w-4" />Save device</Button>
      </form>

      <div className="space-y-3 border-t pt-4">
        <SelectField
          label="Assigned room"
          value={roomId}
          onValueChange={setRoomId}
          options={[
            { value: "none", label: "No room" },
            ...rooms.map((room) => ({ value: room._id, label: room.name }))
          ]}
        />
        <Button variant="outline" disabled={busy} onClick={() => void run(() => apiPost(`/api/devices/${device._id}/move-room`, { roomId: roomId === "none" ? null : roomId }))}>
          <Link2 className="h-4 w-4" />Move device
        </Button>
      </div>

      <div className="border-t pt-4">
        {device.isActive === false ? (
          <Button disabled={busy} onClick={() => void run(() => apiPost(`/api/devices/${device._id}/restore`, {}))}>
            <RotateCcw className="h-4 w-4" />Restore device
          </Button>
        ) : (
          <Button variant="destructive" disabled={busy} onClick={() => void run(() => apiPost(`/api/devices/${device._id}/archive`, {}))}>
            <Archive className="h-4 w-4" />Archive device
          </Button>
        )}
      </div>
    </div>
  );
}
