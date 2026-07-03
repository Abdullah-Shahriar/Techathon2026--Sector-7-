import { z } from "zod";
import { Device, Esp32Node, NodeDiscoveryEvent, Room } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";
import { createRoomSchema } from "../rooms/room.service.js";

export const assignRoomSchema = z.object({
  roomId: z.string().min(1)
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

  const node = await Esp32Node.findOneAndUpdate(
    { nodeId },
    { $set: { roomId: room._id, status: "active" } },
    { new: true }
  );
  if (!node) {
    throw new Error("Node not found");
  }

  await Device.updateMany({ nodeId }, { $set: { roomId: room._id } });
  await NodeDiscoveryEvent.updateMany({ nodeId }, { $set: { status: "handled" } });
  emitRealtime("office_state_updated", { reason: "node_assigned", nodeId, roomId: String(room._id) });
  return node;
}

export async function createRoomFromNode(nodeId: string, input: unknown): Promise<unknown> {
  const parsed = createRoomSchema.parse(input);
  const node = await Esp32Node.findOne({ nodeId });
  if (!node) {
    throw new Error("Node not found");
  }

  const room = await Room.create(parsed);
  node.roomId = room._id;
  node.status = "active";
  await node.save();
  await Device.updateMany({ nodeId }, { $set: { roomId: room._id } });
  await NodeDiscoveryEvent.updateMany({ nodeId }, { $set: { status: "handled" } });
  emitRealtime("office_state_updated", { reason: "room_created_from_node", nodeId, roomId: String(room._id) });
  return { room, node };
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
  await NodeDiscoveryEvent.updateMany({ nodeId }, { $set: { status: "ignored" } });
  emitRealtime("office_state_updated", { reason: "node_ignored", nodeId });
  return node;
}
