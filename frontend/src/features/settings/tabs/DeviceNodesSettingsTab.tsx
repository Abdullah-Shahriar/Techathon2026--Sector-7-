"use client";

import { DeviceNodesSettings } from "@/features/settings/DeviceNodesSettings";
import type { NodeSummary, RoomSummary } from "@/features/api/types";

export function DeviceNodesSettingsTab({
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
  return <DeviceNodesSettings pendingNodes={pendingNodes} nodes={nodes} rooms={rooms} onDone={onDone} />;
}
