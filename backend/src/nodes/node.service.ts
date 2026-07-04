import { z } from "zod";
import { recordAuditLog } from "../audit/audit.service.js";
import { resolveMatchingAlerts } from "../alerts/alert.service.js";
import { Device, DeviceRoomHistory, Esp32Node, NodeDiscoveryEvent, NodeRoomHistory, Room, UsageInterval } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";
import { assertRoomAvailableForNode, createRoomSchema } from "../rooms/room.service.js";

export const assignRoomSchema = z.object({
  roomId: z.string().min(1)
});

const reassignmentModeSchema = z.enum([
  "future_only",
  "move_existing_devices_from_now",
  "create_new_devices_for_new_room",
  "reclassify_history"
]);

export const reassignRoomSchema = z.object({
  roomId: z.string().min(1),
  mode: reassignmentModeSchema.default("future_only"),
  confirmReclassifyHistory: z.boolean().optional()
});

export const unassignNodeSchema = z.object({
  moveExistingDevicesFromNow: z.boolean().default(true)
});

export async function listNodes(): Promise<unknown[]> {
  return Esp32Node.find({}).sort({ createdAt: -1 });
}

export async function listPendingNodes(): Promise<unknown[]> {
  return Esp32Node.find({ status: "pending" }).sort({ createdAt: -1 });
}

export async function assignNodeToRoom(nodeId: string, input: unknown): Promise<unknown> {
  const parsed = assignRoomSchema.parse(input);
  const room = await Room.findById(parsed.roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  await assertRoomAvailableForNode(nodeId, room._id);

  const node = await Esp32Node.findOne({ nodeId });
  if (!node) {
    throw new Error("Node not found");
  }

  const previousRoomId = node.roomId ?? null;
  node.roomId = room._id;
  node.status = "active";
  await node.save();
  await moveDevicesForNode(nodeId, previousRoomId, room._id, "assign", "node_assigned");
  await markNodeDiscoveryHandled(nodeId);
  await recordNodeRoomHistory(nodeId, previousRoomId, room._id, "assign", "node assigned");
  await recordAuditLog({
    action: "node_assigned",
    resourceType: "node",
    resourceId: nodeId,
    dataJson: { fromRoomId: previousRoomId ? String(previousRoomId) : null, toRoomId: String(room._id) }
  });
  emitRealtime("office_state_updated", { reason: "node_assigned", nodeId, roomId: String(room._id) });
  return node;
}

export async function createRoomFromNode(nodeId: string, input: unknown): Promise<unknown> {
  const parsed = createRoomSchema.parse(input);
  const node = await Esp32Node.findOne({ nodeId });
  if (!node) {
    throw new Error("Node not found");
  }
  if (node.roomId) {
    throw new Error("Node is already assigned to a room");
  }

  const room = await Room.create(parsed);
  const previousRoomId = node.roomId ?? null;
  node.roomId = room._id;
  node.status = "active";
  await node.save();
  await moveDevicesForNode(nodeId, previousRoomId, room._id, "create_room", "room_created_from_node");
  await markNodeDiscoveryHandled(nodeId);
  await recordNodeRoomHistory(nodeId, previousRoomId, room._id, "create_room", "room created from node");
  await recordAuditLog({
    action: "room_created",
    resourceType: "room",
    resourceId: room._id,
    dataJson: { nodeId, name: room.name }
  });
  await recordAuditLog({
    action: "node_assigned",
    resourceType: "node",
    resourceId: nodeId,
    dataJson: { fromRoomId: previousRoomId ? String(previousRoomId) : null, toRoomId: String(room._id), mode: "create_room" }
  });
  emitRealtime("office_state_updated", { reason: "room_created_from_node", nodeId, roomId: String(room._id) });
  return { room, node };
}

export async function unassignNode(nodeId: string, input: unknown = {}): Promise<unknown> {
  const parsed = unassignNodeSchema.parse(input);
  const node = await Esp32Node.findOne({ nodeId });
  if (!node) {
    throw new Error("Node not found");
  }

  const previousRoomId = node.roomId ?? null;
  node.roomId = null;
  node.status = node.status === "ignored" || node.status === "archived" ? node.status : "pending";
  await node.save();

  if (parsed.moveExistingDevicesFromNow) {
    await moveDevicesForNode(nodeId, previousRoomId, null, "unassign", "node_unassigned");
  }
  await recordNodeRoomHistory(nodeId, previousRoomId, null, "unassign", "node unassigned");
  await recordAuditLog({
    action: "node_unassigned",
    resourceType: "node",
    resourceId: nodeId,
    dataJson: { fromRoomId: previousRoomId ? String(previousRoomId) : null, moveExistingDevicesFromNow: parsed.moveExistingDevicesFromNow }
  });
  emitRealtime("office_state_updated", { reason: "node_unassigned", nodeId });
  return node;
}

export async function reassignNodeToRoom(nodeId: string, input: unknown): Promise<unknown> {
  const parsed = reassignRoomSchema.parse(input);
  if (parsed.mode === "reclassify_history" && !parsed.confirmReclassifyHistory) {
    throw new Error("reclassify_history requires confirmReclassifyHistory=true");
  }

  const room = await Room.findById(parsed.roomId);
  if (!room || room.isActive === false) {
    throw new Error("Room not found");
  }
  await assertRoomAvailableForNode(nodeId, room._id);

  const node = await Esp32Node.findOne({ nodeId });
  if (!node) {
    throw new Error("Node not found");
  }

  const previousRoomId = node.roomId ?? null;
  node.roomId = room._id;
  node.status = "active";
  await node.save();

  if (parsed.mode === "move_existing_devices_from_now") {
    await moveDevicesForNode(nodeId, previousRoomId, room._id, parsed.mode, "node_reassigned");
  }
  if (parsed.mode === "create_new_devices_for_new_room") {
    await archiveExistingDevicesForFreshDiscovery(nodeId, previousRoomId, room._id);
  }
  if (parsed.mode === "reclassify_history") {
    const deviceIds = await moveDevicesForNode(nodeId, previousRoomId, room._id, parsed.mode, "node_reassigned");
    await UsageInterval.updateMany(
      { deviceId: { $in: deviceIds }, roomId: previousRoomId ?? null },
      { $set: { roomId: room._id, roomIdAtTime: room._id } }
    );
  }

  await markNodeDiscoveryHandled(nodeId);
  await recordNodeRoomHistory(nodeId, previousRoomId, room._id, parsed.mode, "node reassigned");
  await recordAuditLog({
    action: "node_reassigned",
    resourceType: "node",
    resourceId: nodeId,
    dataJson: { fromRoomId: previousRoomId ? String(previousRoomId) : null, toRoomId: String(room._id), mode: parsed.mode }
  });
  emitRealtime("office_state_updated", { reason: "node_reassigned", nodeId, roomId: String(room._id), mode: parsed.mode });
  return node;
}

export async function archiveNode(nodeId: string): Promise<unknown> {
  const node = await Esp32Node.findOne({ nodeId });
  if (!node) {
    throw new Error("Node not found");
  }
  const previousRoomId = node.roomId ?? null;
  node.roomId = null;
  node.status = "archived";
  await node.save();
  await Device.updateMany({ nodeId }, { $set: { isActive: false, archivedAt: new Date(), roomId: null } });
  await recordNodeRoomHistory(nodeId, previousRoomId, null, "archive", "node archived");
  await recordAuditLog({
    action: "node_archived",
    resourceType: "node",
    resourceId: nodeId,
    dataJson: { fromRoomId: previousRoomId ? String(previousRoomId) : null }
  });
  emitRealtime("office_state_updated", { reason: "node_archived", nodeId });
  return node;
}

export async function ignoreNode(nodeId: string): Promise<unknown> {
  const node = await Esp32Node.findOneAndUpdate(
    { nodeId },
    { $set: { status: "ignored", roomId: null } },
    { new: true }
  );
  if (!node) {
    throw new Error("Node not found");
  }
  await Device.updateMany({ nodeId }, { $set: { isActive: false, roomId: null, archivedAt: new Date() } });
  await NodeDiscoveryEvent.updateMany({ nodeId }, { $set: { status: "ignored" } });
  await resolveMatchingAlerts({ alertType: "unknown_esp32_discovered", nodeId, now: new Date() });
  await resolveMatchingAlerts({ alertType: "new_device_discovered", nodeId, now: new Date() });
  await recordAuditLog({
    action: "node_ignored",
    resourceType: "node",
    resourceId: nodeId
  });
  emitRealtime("office_state_updated", { reason: "node_ignored", nodeId });
  return node;
}

async function markNodeDiscoveryHandled(nodeId: string): Promise<void> {
  const now = new Date();
  await NodeDiscoveryEvent.updateMany({ nodeId }, { $set: { status: "handled" } });
  await resolveMatchingAlerts({ alertType: "unknown_esp32_discovered", nodeId, now });
  await resolveMatchingAlerts({ alertType: "new_device_discovered", nodeId, now });
}

async function moveDevicesForNode(
  nodeId: string,
  fromRoomId: unknown,
  toRoomId: unknown,
  mode: string,
  reason: string
): Promise<unknown[]> {
  const devices = await Device.find({ nodeId });
  for (const device of devices) {
    const previousRoomId = device.roomId ?? fromRoomId ?? null;
    device.roomId = toRoomId ?? null;
    device.isActive = true;
    device.archivedAt = null;
    await device.save();
    await DeviceRoomHistory.create({
      deviceId: device._id,
      nodeId,
      externalDeviceId: device.externalDeviceId,
      fromRoomId: previousRoomId,
      toRoomId: toRoomId ?? null,
      mode,
      reason,
      changedAt: new Date()
    });
  }
  return devices.map((device) => device._id);
}

async function archiveExistingDevicesForFreshDiscovery(nodeId: string, fromRoomId: unknown, toRoomId: unknown): Promise<void> {
  const now = new Date();
  const devices = await Device.find({ nodeId });
  for (const device of devices) {
    const archivedNodeId = `${nodeId}#archived-${String(device._id)}-${now.getTime()}`;
    await DeviceRoomHistory.create({
      deviceId: device._id,
      nodeId,
      externalDeviceId: device.externalDeviceId,
      fromRoomId: device.roomId ?? fromRoomId ?? null,
      toRoomId,
      mode: "create_new_devices_for_new_room",
      reason: "old device archived for fresh discovery",
      changedAt: now
    });
    device.nodeId = archivedNodeId;
    device.isActive = false;
    device.archivedAt = now;
    await device.save();
  }
}

async function recordNodeRoomHistory(
  nodeId: string,
  fromRoomId: unknown,
  toRoomId: unknown,
  mode: string,
  reason: string
): Promise<void> {
  await NodeRoomHistory.create({
    nodeId,
    fromRoomId: fromRoomId ?? null,
    toRoomId: toRoomId ?? null,
    mode,
    reason,
    changedAt: new Date()
  });
}
