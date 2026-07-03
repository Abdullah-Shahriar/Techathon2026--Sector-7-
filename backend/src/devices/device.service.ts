import { z } from "zod";
import { Device } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";

export const updateDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["fan", "light", "other"]).optional(),
  expectedPowerWatts: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  roomId: z.string().nullable().optional()
});

export async function listDevices(): Promise<unknown[]> {
  return Device.find({}).sort({ nodeId: 1, externalDeviceId: 1 });
}

export async function getDevice(id: string): Promise<unknown | null> {
  return Device.findById(id);
}

export async function updateDevice(id: string, input: unknown): Promise<unknown | null> {
  const parsed = updateDeviceSchema.parse(input);
  const device = await Device.findByIdAndUpdate(id, { $set: parsed }, { new: true });
  emitRealtime("office_state_updated", { reason: "device_updated", deviceId: id });
  return device;
}
