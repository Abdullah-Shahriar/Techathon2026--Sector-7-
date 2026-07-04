"use client";

import { FormEvent, useState } from "react";
import { Archive, Ban, ChevronDown, Link2, PlugZap, Plus, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrostCard } from "@/components/shared/FrostCard";
import { SectionHeader } from "@/components/shared/PageHeader";
import { SelectField, TextInputField } from "@/components/shared/FormField";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiPost } from "@/features/api/client";
import type { NodeSummary, RoomSummary } from "@/features/api/types";
import { formatDate, titleFromId } from "@/lib/format";

const reassignmentModes = [
  { value: "future_only", label: "Future telemetry only" },
  { value: "move_existing_devices_from_now", label: "Move existing devices from now" },
  { value: "create_new_devices_for_new_room", label: "Create new devices for new room" },
  { value: "reclassify_history", label: "Reclassify history" }
];

export function DeviceNodesSettings({
  pendingNodes,
  nodes,
  rooms,
  onDone
}: {
  pendingNodes: NodeSummary[];
  nodes: NodeSummary[];
  rooms: RoomSummary[];
  onDone: () => Promise<void>;
}) {
  const online = nodes.filter((node) => node.status === "online" || node.status === "active").length;
  const offline = nodes.length - online;

  return (
    <section id="device-nodes" className="space-y-4">
      <SectionHeader
        title="Device Nodes"
        description={`${pendingNodes.length} pending, ${online} online, ${offline} offline or inactive.`}
      />

      {pendingNodes.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {pendingNodes.map((node, index) => (
            <PendingNodeCard key={node.nodeId} node={node} rooms={rooms} index={index} onDone={onDone} />
          ))}
        </div>
      ) : (
        <EmptyState title="No pending device nodes" description="All discovered office nodes have been handled." />
      )}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {nodes.map((node, index) => (
          <ManagedNodeCard key={node.nodeId} node={node} rooms={rooms} index={index} onDone={onDone} />
        ))}
      </div>
    </section>
  );
}

function PendingNodeCard({ node, rooms, index, onDone }: { node: NodeSummary; rooms: RoomSummary[]; index: number; onDone: () => Promise<void> }) {
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
    <FrostCard tone="warning" className="rounded-lg p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold"><PlugZap className="h-4 w-4" />Pending device node {index + 1}</p>
          <p className="mt-1 text-sm text-muted-foreground">Last seen {formatDate(node.lastSeenAt)}</p>
        </div>
        <StatusBadge status={node.status} />
      </div>
      <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={createRoom}>
        <TextInputField label="New room name" value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        <Button className="self-end" disabled={busy}><Plus className="h-4 w-4" />Create room</Button>
      </form>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
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
          <Ban className="h-4 w-4" />Ignore
        </Button>
      </div>
      <AdvancedNodeDetails node={node} />
    </FrostCard>
  );
}

function ManagedNodeCard({ node, rooms, index, onDone }: { node: NodeSummary; rooms: RoomSummary[]; index: number; onDone: () => Promise<void> }) {
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
    <FrostCard tone={node.status === "online" || node.status === "active" ? "success" : "default"} className="rounded-lg p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold"><PlugZap className="h-4 w-4" />Office node {index + 1}</p>
          <p className="mt-1 text-sm text-muted-foreground">Assigned to {rooms.find((room) => room.roomId === node.roomId)?.name ?? "no room"}</p>
        </div>
        <StatusBadge status={node.status} />
      </div>
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
            <Ban className="h-4 w-4" />Ignore
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void run(() => apiPost(`/api/nodes/${node.nodeId}/archive`, {}))}>
            <Archive className="h-4 w-4" />Archive
          </Button>
        </div>
      </div>
      <AdvancedNodeDetails node={node} />
    </FrostCard>
  );
}

function AdvancedNodeDetails({ node }: { node: NodeSummary }) {
  return (
    <details className="mt-4 rounded-lg border bg-background/45 p-3 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground">
        <ChevronDown className="h-3.5 w-3.5" />Advanced details
      </summary>
      <div className="mt-3 space-y-1">
        <p>Raw node ID: {node.nodeId}</p>
        <p>Sequence: {node.lastSequence ?? "-"}</p>
        <p>Last heartbeat: {formatDate(node.lastHeartbeatAt ?? node.lastSeenAt)}</p>
      </div>
    </details>
  );
}
