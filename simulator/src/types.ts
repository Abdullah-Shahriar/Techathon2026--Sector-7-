export type DeviceType = "fan" | "light";
export type DeviceStatus = "on" | "off";
export type MeasurementProfile = "rated" | "low" | "max" | "variable" | "custom";
export type DevicePowerMode = MeasurementProfile;
export type SourceType = "simulator";
export type SimulationMode = "manual" | "auto";
export type TelemetryEventType = "boot" | "heartbeat" | "state_change" | "manual_sync";

export interface RoomDefinition {
  roomId: string;
  roomName: string;
}

export interface RoomNodeDefinition extends RoomDefinition {
  nodeId: string;
}

export interface DeviceDefinition extends RoomDefinition {
  id: string;
  name: string;
  type: DeviceType;
  ratedPowerWatts: number;
  defaultRatedPowerWatts: number;
  minAllowedWatts: number;
  maxAllowedWatts: number;
}

export interface DeviceState extends DeviceDefinition {
  status: DeviceStatus;
  measurementProfile: MeasurementProfile;
  customPowerWatts: number | null;
  currentPowerWatts: number;
  lastChanged: string;
  onSince: string | null;
}

export interface DeviceMeasurements {
  voltageVolts: number;
  currentAmps: number;
  powerWatts: number;
}

export interface DeviceTelemetryState {
  id: string;
  status: DeviceStatus;
  measurements: DeviceMeasurements;
}

export interface RoomState extends RoomNodeDefinition {
  roomPowerWatts: number;
  devices: DeviceState[];
}

export interface SimulatorSnapshot {
  schemaVersion: "1.0";
  sourceType: SourceType;
  timezone: string;
  simulationPaused: boolean;
  simulationMode: SimulationMode;
  updatedAt: string;
  officePowerWatts: number;
  rooms: RoomState[];
}

export interface TelemetryPayload {
  schemaVersion: "1.0";
  nodeId: string;
  sequence: number;
  eventType: TelemetryEventType;
  changedDeviceIds: string[];
  devices: DeviceTelemetryState[];
}

export interface SimulatorConfig {
  backendUrl: string;
  telemetryPath: string;
  telemetryUrl: string;
  deviceApiKey: string;
  controlPort: number;
  tickIntervalMs: number;
  heartbeatIntervalMs: number;
  autoStart: boolean;
  dryRun: boolean;
  timezone: string;
  logLevel: LogLevel;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SendResult {
  ok: boolean;
  dryRun: boolean;
  status?: number;
  statusText?: string;
  error?: string;
  nodeId: string;
  roomId: string;
  sequence: number;
}

export type BackendConnectionState = "idle" | "ok" | "dry-run" | "error";
export type SimulatorEventType =
  | "system"
  | "simulation"
  | "telemetry"
  | "manual-control"
  | "scenario"
  | "error";

export interface SimulatorEvent {
  id: number;
  type: SimulatorEventType;
  time: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TelemetryStatus {
  backendTargetUrl: string;
  telemetryEndpoint: string;
  telemetryUrl: string;
  dryRun: boolean;
  tickIntervalMs: number;
  heartbeatIntervalMs: number;
  lastTelemetrySentAt: string | null;
  backendConnection: BackendConnectionState;
  latestPayload: TelemetryPayload | null;
  latestPayloads: TelemetryPayload[];
  latestPayloadByRoom: Record<string, TelemetryPayload | null>;
  lastResult: SendResult | null;
  lastResults: SendResult[];
  lastResultByRoom: Record<string, SendResult | null>;
  events: SimulatorEvent[];
}

export const SCHEMA_VERSION = "1.0" as const;
export const SOURCE_TYPE = "simulator" as const;
export const DEFAULT_TIMEZONE = "Asia/Dhaka";
export const MAINS_VOLTAGE = 220;
export const FAN_POWER_WATTS = 60;
export const LIGHT_POWER_WATTS = 15;
export const ROOM_MAX_POWER_WATTS = 165;
export const OFFICE_MAX_POWER_WATTS = 495;
