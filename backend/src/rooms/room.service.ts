import { z } from "zod";
import { Device, Esp32Node, NodeDiscoveryEvent, Room } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";

export const createRoomSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default("")
});

export const updateRoomSchema = createRoomSchema.partial().extend({
  isActive: z.boolean().optional()
});

export async function listRooms(): Promise<unknown[]> {
  return Room.find({ isActive: true }).sort({ name: 1 });
}

export async function getRoom(id: string): Promise<unknown | null> {
  return Room.findById(id);
}

export async function createRoom(input: unknown): Promise<unknown> {
  const parsed = createRoomSchema.parse(input);
  const room = await Room.create(parsed);
  emitRealtime("office_state_updated", { reason: "room_created", roomId: String(room._id) });
  return room;
}

export async function updateRoom(id: string, input: unknown): Promise<unknown | null> {
  const parsed = updateRoomSchema.parse(input);
  const room = await Room.findByIdAndUpdate(id, { $set: parsed }, { new: true });
  emitRealtime("office_state_updated", { reason: "room_updated", roomId: id });
  return room;
}

export async function deactivateRoom(id: string): Promise<unknown | null> {
  const room = await Room.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  await Esp32Node.updateMany({ roomId: id }, { $set: { roomId: null, status: "pending" } });
  await Device.updateMany({ roomId: id }, { $set: { roomId: null } });
  emitRealtime("office_state_updated", { reason: "room_deleted", roomId: id });
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
