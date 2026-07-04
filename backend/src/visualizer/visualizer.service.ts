import { z } from "zod";
import { VisualizerLayout } from "../models/index.js";

const roomPlacementSchema = z.object({
  roomId: z.string().min(1),
  x: z.number().min(0).max(5000),
  y: z.number().min(0).max(5000),
  width: z.number().min(180).max(5000),
  height: z.number().min(160).max(5000),
  theme: z.enum(["tile", "wood", "carpet"])
});

const devicePlacementSchema = z.object({
  deviceId: z.string().min(1),
  roomId: z.string().min(1),
  x: z.number().min(0).max(5000),
  y: z.number().min(0).max(5000)
});

const layoutSchema = z.object({
  canvas: z.object({
    width: z.number().min(640).max(5000),
    height: z.number().min(420).max(5000)
  }),
  rooms: z.array(roomPlacementSchema).max(500),
  devices: z.array(devicePlacementSchema).max(5000)
}).superRefine((layout, context) => {
  const roomIds = new Set<string>();
  for (const room of layout.rooms) {
    if (roomIds.has(room.roomId)) {
      context.addIssue({ code: "custom", message: `Duplicate room placement: ${room.roomId}` });
    }
    roomIds.add(room.roomId);
    if (room.x + room.width > layout.canvas.width || room.y + room.height > layout.canvas.height) {
      context.addIssue({ code: "custom", message: `Room ${room.roomId} is outside the canvas` });
    }
  }

  const deviceIds = new Set<string>();
  for (const device of layout.devices) {
    if (deviceIds.has(device.deviceId)) {
      context.addIssue({ code: "custom", message: `Duplicate device placement: ${device.deviceId}` });
    }
    deviceIds.add(device.deviceId);
    if (!roomIds.has(device.roomId)) {
      context.addIssue({ code: "custom", message: `Device ${device.deviceId} has no room placement` });
    }
  }
});

export type VisualizerLayoutInput = z.infer<typeof layoutSchema>;

const EMPTY_LAYOUT: VisualizerLayoutInput = {
  canvas: { width: 1200, height: 720 },
  rooms: [],
  devices: []
};

export async function getVisualizerLayout(): Promise<VisualizerLayoutInput> {
  const layout = await VisualizerLayout.findOne({ key: "default" }).lean();
  if (!layout) return EMPTY_LAYOUT;

  return {
    canvas: layout.canvas,
    rooms: layout.rooms.map(stripMongoId),
    devices: layout.devices.map(stripMongoId)
  } as VisualizerLayoutInput;
}

export async function saveVisualizerLayout(input: unknown): Promise<VisualizerLayoutInput> {
  const parsed = layoutSchema.parse(input);
  const layout = await VisualizerLayout.findOneAndUpdate(
    { key: "default" },
    { $set: parsed, $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    canvas: layout!.canvas,
    rooms: layout!.rooms.map(stripMongoId),
    devices: layout!.devices.map(stripMongoId)
  } as VisualizerLayoutInput;
}

function stripMongoId<T extends Record<string, unknown>>(value: T): Omit<T, "_id"> {
  const { _id: _unused, ...rest } = value;
  return rest;
}
