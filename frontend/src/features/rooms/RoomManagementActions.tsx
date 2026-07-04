"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Archive, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPatch, apiPost } from "@/features/api/client";
import type { ManagedRoom } from "@/features/api/types";
import { TextInputField } from "@/components/shared/FormField";

export function RoomManagementActions({ room, onDone }: { room: ManagedRoom; onDone: () => Promise<void> }) {
  const [name, setName] = useState(room.name);
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
    await run(() => apiPatch(`/api/rooms/${room._id}`, { name }));
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={submit}>
        <TextInputField label="Room name" value={name} onChange={(event) => setName(event.target.value)} />
        <Button disabled={busy}><Save className="h-4 w-4" />Save room</Button>
      </form>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {room.isActive === false ? (
          <Button disabled={busy} onClick={() => void run(() => apiPost(`/api/rooms/${room._id}/restore`, {}))}>
            <RotateCcw className="h-4 w-4" />Restore
          </Button>
        ) : (
          <Button variant="destructive" disabled={busy} onClick={() => void run(() => apiPost(`/api/rooms/${room._id}/archive`, {}))}>
            <Archive className="h-4 w-4" />Archive
          </Button>
        )}
        <Button asChild variant="outline"><Link href="/devices">Move devices</Link></Button>
      </div>
    </div>
  );
}
