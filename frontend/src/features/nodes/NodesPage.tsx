"use client";

import { FormEvent, useState } from "react";
import { Archive, Ban, Link2, Plus, RadioTower, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { NodeCard } from "@/components/shared/DomainCards";
import { SelectField, TextInputField } from "@/components/shared/FormField";
import { ErrorState, LoadingState, EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { apiPost } from "@/features/api/client";
import type { NodeSummary, RoomSummary } from "@/features/api/types";
import { formatDate, titleFromId } from "@/lib/format";

const reassignmentModes = [
  { value: "future_only", label: "Future telemetry only" },
  { value: "move_existing_devices_from_now", label: "Move existing devices from now" },
  { value: "create_new_devices_for_new_room", label: "Create new devices for new room" },
  { value: "reclassify_history", label: "Reclassify history" }
];

export function NodesPage() {
  const { state, error, refresh } = useOfficeDataContext();

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ESP32 node health"
        title="Discover, assign, unbind, and forget room nodes safely."
        description="Node actions are explicit and backend-owned. Safe reassignment modes make it clear whether devices or history should move."
      />

      <section>
        <SectionHeader title="Pending nodes" description="New ESP32 nodes waiting for a room decision." />
        {state.pendingNodes.length === 0 ? (
          <EmptyState title="No pending ESP32 nodes" description="All discovered nodes have been handled." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {state.pendingNodes.map((node) => <PendingNodeCard key={node.nodeId} node={node} rooms={state.rooms} onDone={refresh} />)}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Node health</CardTitle>
          <CardDescription>Last seen, heartbeat, sequence, and room binding state.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {state.nodes.map((node) => <ManagedNodeCard key={node.nodeId} node={node} rooms={state.rooms} onDone={refresh} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingNodeCard({ node, rooms, onDone }: { node: NodeSummary; rooms: RoomSummary[]; onDone: () => Promise<void> }) {
  const [roomName, setRoomName] = useState(titleFromId(node.nodeId));
  const [roomId, setRoomId] = useState(rooms[0]?.roomId ?? "none");
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

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    await run(() => apiPost(`/api/nodes/${node.nodeId}/create-room`, { name: roomName }));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-primary" />{node.nodeId}</CardTitle>
            <CardDescription>Sequence {node.lastSequence ?? "-"} / last seen {formatDate(node.lastSeenAt)}</CardDescription>
          </div>
          <StatusBadge status={node.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={createRoom}>
          <TextInputField label="New room name" value={roomName} onChange={(event) => setRoomName(event.target.value)} />
          <Button className="self-end" disabled={busy}><Plus className="h-4 w-4" />Create room</Button>
        </form>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <SelectField
            label="Existing room"
            value={roomId}
            onValueChange={setRoomId}
            options={[{ value: "none", label: "Select room" }, ...rooms.map((room) => ({ value: room.roomId, label: room.name }))]}
          />
          <Button className="self-end" disabled={busy || roomId === "none"} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/assign-room`, { roomId }))}>
            <Link2 className="h-4 w-4" />Assign
          </Button>
          <Button className="self-end" variant="destructive" disabled={busy} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/ignore`, {}))}>
            <Ban className="h-4 w-4" />Forget
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagedNodeCard({ node, rooms, onDone }: { node: NodeSummary; rooms: RoomSummary[]; onDone: () => Promise<void> }) {
  const [roomId, setRoomId] = useState(node.roomId ?? "none");
  const [mode, setMode] = useState("future_only");
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

  return (
    <NodeCard node={node}>
      <div className="grid gap-3">
        <SelectField
          label="Target room"
          value={roomId}
          onValueChange={setRoomId}
          options={[{ value: "none", label: "No room" }, ...rooms.map((room) => ({ value: room.roomId, label: room.name }))]}
        />
        <SelectField label="Reassignment mode" value={mode} onValueChange={setMode} options={reassignmentModes} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/unassign`, { moveExistingDevicesFromNow: true }))}>
            <Unlink className="h-4 w-4" />Unassign
          </Button>
          <Button disabled={busy || roomId === "none"} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/reassign-room`, { roomId, mode, confirmReclassifyHistory: mode === "reclassify_history" }))}>
            <Link2 className="h-4 w-4" />Reassign
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/ignore`, {}))}>
            <Ban className="h-4 w-4" />Forget
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/archive`, {}))}>
            <Archive className="h-4 w-4" />Archive
          </Button>
        </div>
      </div>
    </NodeCard>
  );
}
