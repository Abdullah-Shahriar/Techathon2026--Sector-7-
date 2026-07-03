import type { Types } from "mongoose";

export type DeviceStatus = "on" | "off";
export type DeviceType = "fan" | "light" | "other";
export type NodeStatus = "pending" | "active" | "ignored" | "offline";
export type TelemetryEventType = "boot" | "heartbeat" | "state_change" | "manual_sync";
export type SequenceStatus = "ok" | "duplicate" | "missed";
export type AlertStatus = "active" | "resolved" | "acknowledged";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertScope = "global" | "room" | "device" | "node";
export type AlertSettingScope = "global" | "room" | "device";

export interface TelemetryMeasurements {
  voltageVolts: number;
  currentAmps: number;
  powerWatts: number;
}

export interface TelemetryDeviceInput {
  id: string;
  status: DeviceStatus;
  measurements: TelemetryMeasurements;
}

export interface TelemetryPayloadInput {
  schemaVersion: "1.0";
  nodeId: string;
  sequence: number;
  eventType: TelemetryEventType;
  changedDeviceIds: string[];
  devices: TelemetryDeviceInput[];
}

export type ObjectIdLike = Types.ObjectId | string;
