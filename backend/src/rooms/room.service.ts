import { z } from "zod";
import { recordAuditLog } from "../audit/audit.service.js";
import { Device, Esp32Node, NodeDiscoveryEvent, NodeRoomHistory, Room } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";

export const createRoomSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default("")
});

export const updateRoomSchema = createRoomSchema.partial().extend({
  isActive: z.boolean().optional()
});

export async function listRooms(input: { includeInactive?: boolean } = {}): Promise<unknown[]> {
  return Room.find(input.includeInactive ? {} : { isActive: true }).sort({ isActive: -1, name: 1 });
}

export async function getRoom(id: string): Promise<unknown | null> {
  return Room.findById(id);
}

export async function createRoom(input: unknown): Promise<unknown> {
  const parsed = createRoomSchema.parse(input);
  const room = await Room.create(parsed);
  await recordAuditLog({
    action: "room_created",
    resourceType: "room",
    resourceId: room._id,
    dataJson: { name: room.name }
  });
  emitRealtime("office_state_updated", { reason: "room_created", roomId: String(room._id) });
  return room;
}

export async function updateRoom(id: string, input: unknown): Promise<unknown | null> {
  const parsed = updateRoomSchema.parse(input);
  const room = await Room.findByIdAndUpdate(id, { $set: parsed }, { new: true });
  if (room) {
    await recordAuditLog({
      action: "room_renamed",
      resourceType: "room",
      resourceId: id,
      dataJson: parsed
    });
  }
  emitRealtime("office_state_updated", { reason: "room_updated", roomId: id });
  return room;
}

export async function archiveRoom(id: string): Promise<unknown | null> {
  const now = new Date();
  const room = await Room.findByIdAndUpdate(id, { $set: { isActive: false, archivedAt: now } }, { new: true });
  const nodes = await Esp32Node.find({ roomId: id });
  await Esp32Node.updateMany({ roomId: id }, { $set: { roomId: null, status: "pending" } });
  await Device.updateMany({ roomId: id }, { $set: { roomId: null } });
  if (nodes.length > 0) {
    await NodeRoomHistory.insertMany(nodes.map((node) => ({
      nodeId: node.nodeId,
      fromRoomId: id,
      toRoomId: null,
      mode: "archive_room",
      reason: "room archived",
      changedAt: now
    })));
  }
  if (room) {
    await recordAuditLog({
      action: "room_archived",
      resourceType: "room",
      resourceId: id,
      dataJson: { unassignedNodeCount: nodes.length }
    });
  }
  emitRealtime("office_state_updated", { reason: "room_deleted", roomId: id });
  return room;
}

export const deactivateRoom = archiveRoom;

export async function restoreRoom(id: string): Promise<unknown | null> {
  const room = await Room.findByIdAndUpdate(id, { $set: { isActive: true, archivedAt: null } }, { new: true });
  if (room) {
    await recordAuditLog({
      action: "room_restored",
      resourceType: "room",
      resourceId: id
    });
  }
  emitRealtime("office_state_updated", { reason: "room_restored", roomId: id });
  return room;
}

export async function attachNodeToRoom(nodeId: string, roomId: string): Promise<unknown> {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  await assertRoomAvailableForNode(nodeId, room._id);

  const node = await Esp32Node.findOneAndUpdate(
    { nodeId },
    { $set: { roomId: room._id, status: "active" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await Device.updateMany({ nodeId }, { $set: { roomId: room._id } });
  await NodeDiscoveryEvent.updateMany({ nodeId }, { $set: { status: "handled" } });
  await NodeRoomHistory.create({
    nodeId,
    fromRoomId: null,
    toRoomId: room._id,
    mode: "attach",
    reason: "node attached to room",
    changedAt: new Date()
  });
  await recordAuditLog({
    action: "node_assigned",
    resourceType: "node",
    resourceId: nodeId,
    dataJson: { roomId }
  });
  emitRealtime("office_state_updated", { reason: "node_assigned", nodeId, roomId });
  return node;
}

export async function assertRoomAvailableForNode(nodeId: string, roomId: unknown): Promise<void> {
  const existing = await Esp32Node.findOne({
    roomId,
    nodeId: { $ne: nodeId },
    status: { $in: ["active", "offline"] }
  }).lean();

  if (existing) {
    throw new Error(`Room is already assigned to ${existing.nodeId}`);
  }
}
