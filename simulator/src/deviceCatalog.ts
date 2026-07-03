import type { DeviceDefinition, DeviceType, RoomDefinition, RoomNodeDefinition } from "./types.js";
import {
  FAN_POWER_WATTS,
  LIGHT_POWER_WATTS,
  OFFICE_MAX_POWER_WATTS,
  ROOM_MAX_POWER_WATTS
} from "./types.js";

export const ROOM_DEFINITIONS: readonly RoomDefinition[] = [
  { roomId: "drawing", roomName: "Drawing Room" },
  { roomId: "work1", roomName: "Work Room 1" },
  { roomId: "work2", roomName: "Work Room 2" }
];

export const ROOM_NODES: readonly RoomNodeDefinition[] = ROOM_DEFINITIONS.map((room) => ({
  ...room,
  nodeId: `room-node-${room.roomId}`
}));

export const DEVICE_CATALOG: readonly DeviceDefinition[] = ROOM_DEFINITIONS.flatMap((room) => [
  createDevice(room, "fan", 1),
  createDevice(room, "fan", 2),
  createDevice(room, "light", 1),
  createDevice(room, "light", 2),
  createDevice(room, "light", 3)
]);

export function getRoomDefinition(roomId: string): RoomDefinition | undefined {
  return ROOM_DEFINITIONS.find((room) => room.roomId === roomId);
}

export function getRoomNode(roomId: string): RoomNodeDefinition | undefined {
  return ROOM_NODES.find((node) => node.roomId === roomId);
}

export function getDeviceDefinition(deviceId: string): DeviceDefinition | undefined {
  return DEVICE_CATALOG.find((device) => device.id === deviceId);
}

export function getDevicesForRoom(roomId: string): DeviceDefinition[] {
  return DEVICE_CATALOG.filter((device) => device.roomId === roomId);
}

export function assertCatalogIntegrity(): void {
  const ids = new Set<string>();
  for (const device of DEVICE_CATALOG) {
    if (ids.has(device.id)) {
      throw new Error(`Duplicate device id: ${device.id}`);
    }

    ids.add(device.id);
  }

  if (DEVICE_CATALOG.length !== 15) {
    throw new Error(`Expected 15 devices, found ${DEVICE_CATALOG.length}`);
  }

  for (const room of ROOM_DEFINITIONS) {
    const devices = getDevicesForRoom(room.roomId);
    const fanCount = devices.filter((device) => device.type === "fan").length;
    const lightCount = devices.filter((device) => device.type === "light").length;
    const maxPower = devices.reduce((sum, device) => sum + device.ratedPowerWatts, 0);

    if (fanCount !== 2 || lightCount !== 3) {
      throw new Error(`${room.roomId} must have exactly 2 fans and 3 lights`);
    }

    if (maxPower !== ROOM_MAX_POWER_WATTS) {
      throw new Error(`${room.roomId} max power must be ${ROOM_MAX_POWER_WATTS}W`);
    }
  }

  const officeMaxPower = DEVICE_CATALOG.reduce((sum, device) => sum + device.ratedPowerWatts, 0);
  if (officeMaxPower !== OFFICE_MAX_POWER_WATTS) {
    throw new Error(`Office max power must be ${OFFICE_MAX_POWER_WATTS}W`);
  }
}

function createDevice(room: RoomDefinition, type: DeviceType, number: number): DeviceDefinition {
  const ratedPowerWatts = type === "fan" ? FAN_POWER_WATTS : LIGHT_POWER_WATTS;
  const displayType = type === "fan" ? "Fan" : "Light";
  const minAllowedWatts = type === "fan" ? 10 : 1;
  const maxAllowedWatts = type === "fan" ? 150 : 100;

  return {
    ...room,
    id: `${room.roomId}-${type}-${number}`,
    name: `${displayType} ${number}`,
    type,
    ratedPowerWatts,
    defaultRatedPowerWatts: ratedPowerWatts,
    minAllowedWatts,
    maxAllowedWatts
  };
}
