import { z } from "zod";

const measurementsSchema = z.object({
  voltageVolts: z.number().nonnegative(),
  currentAmps: z.number().nonnegative(),
  powerWatts: z.number().nonnegative()
}).strict();

const deviceTelemetrySchema = z.object({
  id: z.string().min(1),
  status: z.enum(["on", "off"]),
  measurements: measurementsSchema
}).strict();

export const telemetryPayloadSchema = z.object({
  schemaVersion: z.literal("1.0"),
  nodeId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  eventType: z.enum(["boot", "heartbeat", "state_change", "manual_sync"]),
  changedDeviceIds: z.array(z.string().min(1)),
  devices: z.array(deviceTelemetrySchema).min(1)
}).strict();

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
