import { DEVICE_CATALOG, ROOM_NODES, getDeviceDefinition, getDevicesForRoom, getRoomNode } from "./deviceCatalog.js";
import type {
  DeviceState,
  DeviceStatus,
  DeviceTelemetryState,
  MeasurementProfile,
  RoomState,
  SimulationMode,
  SimulatorSnapshot,
  TelemetryPayload,
  TelemetryEventType
} from "./types.js";
import { DEFAULT_TIMEZONE, MAINS_VOLTAGE, SCHEMA_VERSION, SOURCE_TYPE } from "./types.js";

interface WattageUpdate {
  ratedPowerWatts?: number;
  customPowerWatts?: number | null;
  reset?: boolean;
}

export class SimulatorStateStore {
  private readonly deviceStates = new Map<string, DeviceState>();
  private readonly sequenceByRoom = new Map<string, number>();
  private mode: SimulationMode = "manual";
  private paused = true;
  private updatedAt: string;

  constructor(
    private readonly timezone = DEFAULT_TIMEZONE,
    now = new Date()
  ) {
    this.updatedAt = toIsoWithTimezone(now, this.timezone);
    this.reset(now);
  }

  getTimezone(): string {
    return this.timezone;
  }

  isSimulationPaused(): boolean {
    return this.paused;
  }

  getSimulationMode(): SimulationMode {
    return this.mode;
  }

  setSimulationMode(mode: SimulationMode, now = new Date()): void {
    this.mode = mode;
    this.paused = mode === "manual" ? true : false;
    this.updatedAt = toIsoWithTimezone(now, this.timezone);
  }

  setSimulationPaused(paused: boolean, now = new Date()): void {
    this.paused = paused;
    this.updatedAt = toIsoWithTimezone(now, this.timezone);
  }

  reset(now = new Date()): void {
    const timestamp = toIsoWithTimezone(now, this.timezone);
    this.deviceStates.clear();
    this.sequenceByRoom.clear();

    for (const device of DEVICE_CATALOG) {
      this.deviceStates.set(device.id, {
        ...device,
        status: "off",
        measurementProfile: "rated",
        customPowerWatts: null,
        currentPowerWatts: 0,
        lastChanged: timestamp,
        onSince: null
      });
    }

    for (const node of ROOM_NODES) {
      this.sequenceByRoom.set(node.roomId, 0);
    }

    this.updatedAt = timestamp;
  }

  getDevice(deviceId: string): DeviceState | undefined {
    const device = this.deviceStates.get(deviceId);
    return device ? cloneDevice(device) : undefined;
  }

  setDeviceStatus(deviceId: string, status: DeviceStatus, now = new Date()): DeviceState {
    if (!getDeviceDefinition(deviceId)) {
      throw new Error(`Unknown device id: ${deviceId}`);
    }

    const current = this.deviceStates.get(deviceId);
    if (!current) {
      throw new Error(`Missing state for device id: ${deviceId}`);
    }

    if (current.status === status) {
      return cloneDevice(current);
    }

    const timestamp = toIsoWithTimezone(now, this.timezone);
    const next: DeviceState = {
      ...current,
      status,
      currentPowerWatts: calculateCurrentPower({ ...current, status }),
      lastChanged: timestamp,
      onSince: status === "on" ? timestamp : null
    };

    this.deviceStates.set(deviceId, next);
    this.updatedAt = timestamp;
    return cloneDevice(next);
  }

  toggleDevice(deviceId: string, now = new Date()): DeviceState {
    const current = this.deviceStates.get(deviceId);
    if (!current) {
      throw new Error(`Unknown device id: ${deviceId}`);
    }

    return this.setDeviceStatus(deviceId, current.status === "on" ? "off" : "on", now);
  }

  setDeviceWattage(deviceId: string, update: WattageUpdate, now = new Date()): DeviceState {
    const current = this.requireDeviceState(deviceId);
    const definition = getDeviceDefinition(deviceId);
    if (!definition) {
      throw new Error(`Unknown device id: ${deviceId}`);
    }

    const ratedPowerWatts = update.reset
      ? definition.defaultRatedPowerWatts
      : update.ratedPowerWatts ?? current.ratedPowerWatts;
    const customPowerWatts = update.reset
      ? null
      : Object.prototype.hasOwnProperty.call(update, "customPowerWatts")
        ? update.customPowerWatts ?? null
        : current.customPowerWatts;

    validateWatts(ratedPowerWatts, current.minAllowedWatts, current.maxAllowedWatts, "ratedPowerWatts");
    if (customPowerWatts !== null) {
      validateWatts(customPowerWatts, current.minAllowedWatts, current.maxAllowedWatts, "customPowerWatts");
    }

    const next: DeviceState = {
      ...current,
      ratedPowerWatts,
      customPowerWatts,
      currentPowerWatts: calculateCurrentPower({ ...current, ratedPowerWatts, customPowerWatts })
    };

    this.deviceStates.set(deviceId, next);
    this.updatedAt = toIsoWithTimezone(now, this.timezone);
    return cloneDevice(next);
  }

  setDeviceMeasurementProfile(deviceId: string, measurementProfile: MeasurementProfile, now = new Date()): DeviceState {
    const current = this.requireDeviceState(deviceId);
    const next: DeviceState = {
      ...current,
      measurementProfile,
      currentPowerWatts: calculateCurrentPower({ ...current, measurementProfile })
    };

    this.deviceStates.set(deviceId, next);
    this.updatedAt = toIsoWithTimezone(now, this.timezone);
    return cloneDevice(next);
  }

  setDevicePowerMode(deviceId: string, powerMode: MeasurementProfile, now = new Date()): DeviceState {
    return this.setDeviceMeasurementProfile(deviceId, powerMode, now);
  }

  setRoomStatus(roomId: string, status: DeviceStatus, now = new Date()): RoomState {
    const devices = getDevicesForRoom(roomId);
    if (devices.length === 0) {
      throw new Error(`Unknown room id: ${roomId}`);
    }

    for (const device of devices) {
      this.setDeviceStatus(device.id, status, now);
    }

    return this.getRoomState(roomId);
  }

  setAllStatus(status: DeviceStatus, now = new Date()): SimulatorSnapshot {
    for (const device of DEVICE_CATALOG) {
      this.setDeviceStatus(device.id, status, now);
    }

    return this.getSnapshot(now);
  }

  calculateRoomPower(roomId: string): number {
    const devices = getDevicesForRoom(roomId);
    if (devices.length === 0) {
      throw new Error(`Unknown room id: ${roomId}`);
    }

    return devices.reduce((sum, device) => {
      const state = this.deviceStates.get(device.id);
      return sum + (state?.currentPowerWatts ?? 0);
    }, 0);
  }

  calculateOfficePower(): number {
    return ROOM_NODES.reduce((sum, room) => sum + this.calculateRoomPower(room.roomId), 0);
  }

  getRoomState(roomId: string): RoomState {
    const node = getRoomNode(roomId);
    if (!node) {
      throw new Error(`Unknown room id: ${roomId}`);
    }

    const devices = getDevicesForRoom(roomId).map((device) => {
      const state = this.deviceStates.get(device.id);
      if (!state) {
        throw new Error(`Missing state for device id: ${device.id}`);
      }

      return cloneDevice(state);
    });

    return {
      ...node,
      roomPowerWatts: devices.reduce((sum, device) => sum + device.currentPowerWatts, 0),
      devices
    };
  }

  getSnapshot(now = new Date()): SimulatorSnapshot {
    return {
      schemaVersion: SCHEMA_VERSION,
      sourceType: SOURCE_TYPE,
      timezone: this.timezone,
      simulationPaused: this.paused,
      simulationMode: this.mode,
      updatedAt: this.updatedAt || toIsoWithTimezone(now, this.timezone),
      officePowerWatts: this.calculateOfficePower(),
      rooms: ROOM_NODES.map((room) => this.getRoomState(room.roomId))
    };
  }

  buildTelemetryPayload(
    roomId: string,
    sequence: number,
    eventType: TelemetryEventType,
    changedDeviceIds: string[] = []
  ): TelemetryPayload {
    const room = this.getRoomState(roomId);

    return {
      schemaVersion: SCHEMA_VERSION,
      nodeId: room.nodeId,
      sequence,
      eventType,
      changedDeviceIds: [...changedDeviceIds],
      devices: room.devices.map(toTelemetryDevice)
    };
  }

  nextTelemetryPayload(
    roomId: string,
    eventType: TelemetryEventType,
    changedDeviceIds: string[] = []
  ): TelemetryPayload {
    const current = this.sequenceByRoom.get(roomId);
    if (current === undefined) {
      throw new Error(`Unknown room id: ${roomId}`);
    }

    const nextSequence = current + 1;
    this.sequenceByRoom.set(roomId, nextSequence);
    return this.buildTelemetryPayload(roomId, nextSequence, eventType, changedDeviceIds);
  }

  nextTelemetryBatch(
    eventType: TelemetryEventType,
    changedDeviceIdsByRoom: Record<string, string[]> = {}
  ): TelemetryPayload[] {
    return ROOM_NODES.map((room) => (
      this.nextTelemetryPayload(room.roomId, eventType, changedDeviceIdsByRoom[room.roomId] ?? [])
    ));
  }

  refreshVariablePowerForRoom(roomId: string, now = new Date()): RoomState {
    for (const device of getDevicesForRoom(roomId)) {
      const current = this.deviceStates.get(device.id);
      if (!current || current.status !== "on" || current.measurementProfile !== "variable") {
        continue;
      }

      const next = {
        ...current,
        currentPowerWatts: calculateCurrentPower(current)
      };
      this.deviceStates.set(device.id, next);
    }

    this.updatedAt = toIsoWithTimezone(now, this.timezone);
    return this.getRoomState(roomId);
  }

  private requireDeviceState(deviceId: string): DeviceState {
    const current = this.deviceStates.get(deviceId);
    if (!current) {
      throw new Error(`Unknown device id: ${deviceId}`);
    }

    return current;
  }
}

export function calculateCurrentPower(device: Pick<
  DeviceState,
  "status" | "ratedPowerWatts" | "minAllowedWatts" | "maxAllowedWatts" | "measurementProfile" | "customPowerWatts"
>): number {
  if (device.status === "off") {
    return 0;
  }

  if (device.measurementProfile === "low") {
    return clampWatts(Math.round(device.ratedPowerWatts * 0.55), device.minAllowedWatts, device.maxAllowedWatts);
  }

  if (device.measurementProfile === "max") {
    return device.maxAllowedWatts;
  }

  if (device.measurementProfile === "variable") {
    const minimum = Math.max(device.minAllowedWatts, Math.round(device.ratedPowerWatts * 0.65));
    const maximum = Math.min(device.maxAllowedWatts, Math.max(minimum, Math.round(device.ratedPowerWatts * 1.15)));
    return randomInteger(minimum, maximum);
  }

  if (device.measurementProfile === "custom") {
    return clampWatts(device.customPowerWatts ?? device.ratedPowerWatts, device.minAllowedWatts, device.maxAllowedWatts);
  }

  return clampWatts(device.ratedPowerWatts, device.minAllowedWatts, device.maxAllowedWatts);
}

export function toIsoWithTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  ) as Record<string, string>;

  const year = numberPart(parts.year, "year");
  const month = numberPart(parts.month, "month");
  const day = numberPart(parts.day, "day");
  const hour = numberPart(parts.hour, "hour");
  const minute = numberPart(parts.minute, "minute");
  const second = numberPart(parts.second, "second");
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, date.getMilliseconds());
  const offsetMinutes = Math.round((localAsUtcMs - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetRemainder = String(absoluteOffset % 60).padStart(2, "0");

  return [
    `${year}-${pad2(month)}-${pad2(day)}`,
    "T",
    `${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${String(date.getMilliseconds()).padStart(3, "0")}`,
    `${sign}${offsetHours}:${offsetRemainder}`
  ].join("");
}

function cloneDevice(device: DeviceState): DeviceState {
  return { ...device };
}

function toTelemetryDevice(device: DeviceState): DeviceTelemetryState {
  const voltageVolts = device.status === "on" ? MAINS_VOLTAGE : 0;
  const powerWatts = device.status === "on" ? device.currentPowerWatts : 0;

  return {
    id: device.id,
    status: device.status,
    measurements: {
      voltageVolts,
      currentAmps: voltageVolts > 0 ? Number((powerWatts / voltageVolts).toFixed(3)) : 0,
      powerWatts
    }
  };
}

function validateWatts(value: number, minAllowedWatts: number, maxAllowedWatts: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < minAllowedWatts || value > maxAllowedWatts) {
    throw new Error(`${fieldName} must be between ${minAllowedWatts}W and ${maxAllowedWatts}W`);
  }
}

function clampWatts(value: number, minAllowedWatts: number, maxAllowedWatts: number): number {
  return Math.max(minAllowedWatts, Math.min(maxAllowedWatts, value));
}

function randomInteger(minimum: number, maximum: number): number {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function numberPart(value: string | undefined, name: string): number {
  if (!value) {
    throw new Error(`Missing ${name} in formatted date`);
  }

  return Number(value);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
