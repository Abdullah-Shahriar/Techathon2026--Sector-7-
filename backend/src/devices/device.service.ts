import { z } from "zod";
import { recordAuditLog } from "../audit/audit.service.js";
import { resolveNewDeviceDiscoveryAlert } from "../alerts/alert.service.js";
import { Device, DeviceRoomHistory, Room } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";

export const updateDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["fan", "light", "other"]).optional(),
  expectedPowerWatts: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  roomId: z.string().nullable().optional()
});

export const moveDeviceRoomSchema = z.object({
  roomId: z.string().nullable()
});

export async function listDevices(input: { includeInactive?: boolean } = {}): Promise<unknown[]> {
  return Device.find(input.includeInactive ? {} : { isActive: true }).sort({ isActive: -1, nodeId: 1, externalDeviceId: 1 });
}

export async function getDevice(id: string): Promise<unknown | null> {
  return Device.findById(id);
}

export async function updateDevice(id: string, input: unknown): Promise<unknown | null> {
  const parsed = updateDeviceSchema.parse(input);
  const device = await Device.findByIdAndUpdate(id, { $set: parsed }, { new: true });
  if (device) {
    await resolveNewDeviceDiscoveryAlert({ nodeId: device.nodeId, externalDeviceId: device.externalDeviceId });
    await recordAuditLog({
      action: "device_updated",
      resourceType: "device",
      resourceId: id,
      dataJson: parsed
    });
  }
  emitRealtime("office_state_updated", { reason: "device_updated", deviceId: id });
  return device;
}

export async function moveDeviceToRoom(id: string, input: unknown): Promise<unknown | null> {
  const parsed = moveDeviceRoomSchema.parse(input);
  const device = await Device.findById(id);
  if (!device) {
    return null;
  }
  if (parsed.roomId) {
    const room = await Room.findById(parsed.roomId);
    if (!room || room.isActive === false) {
      throw new Error("Room not found");
    }
  }

  const fromRoomId = device.roomId ?? null;
  device.roomId = parsed.roomId ?? null;
  device.isActive = true;
  device.archivedAt = null;
  await device.save();
  await DeviceRoomHistory.create({
    deviceId: device._id,
    nodeId: device.nodeId,
    externalDeviceId: device.externalDeviceId,
    fromRoomId,
    toRoomId: parsed.roomId ?? null,
    mode: "move_existing_devices_from_now",
    reason: "device moved",
    changedAt: new Date()
  });
  await resolveNewDeviceDiscoveryAlert({ nodeId: device.nodeId, externalDeviceId: device.externalDeviceId });
  await recordAuditLog({
    action: "device_moved",
    resourceType: "device",
    resourceId: id,
    dataJson: { fromRoomId: fromRoomId ? String(fromRoomId) : null, toRoomId: parsed.roomId ?? null }
  });
  emitRealtime("office_state_updated", { reason: "device_moved", deviceId: id, roomId: parsed.roomId ?? null });
  return device;
}

export async function archiveDevice(id: string): Promise<unknown | null> {
  const device = await Device.findByIdAndUpdate(
    id,
    { $set: { isActive: false, archivedAt: new Date() } },
    { new: true }
  );
  if (device) {
    await recordAuditLog({
      action: "device_archived",
      resourceType: "device",
      resourceId: id,
      dataJson: { nodeId: device.nodeId, externalDeviceId: device.externalDeviceId }
    });
    emitRealtime("office_state_updated", { reason: "device_archived", deviceId: id });
  }
  return device;
}

export async function restoreDevice(id: string): Promise<unknown | null> {
  const device = await Device.findByIdAndUpdate(
    id,
    { $set: { isActive: true, archivedAt: null } },
    { new: true }
  );
  if (device) {
    await resolveNewDeviceDiscoveryAlert({ nodeId: device.nodeId, externalDeviceId: device.externalDeviceId });
    await recordAuditLog({
      action: "device_restored",
      resourceType: "device",
      resourceId: id,
      dataJson: { nodeId: device.nodeId, externalDeviceId: device.externalDeviceId }
    });
    emitRealtime("office_state_updated", { reason: "device_restored", deviceId: id });
  }
  return device;
}
