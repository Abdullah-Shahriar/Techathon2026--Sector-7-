import type { DeviceStatus } from "./types.js";
import type { SimulatorStateStore } from "./stateStore.js";

export type RandomSource = () => number;
export interface RoomNodeDeviceChanges {
  roomId: string;
  changedDeviceIds: string[];
}

export function applyAutoPattern(
  store: SimulatorStateStore,
  now = new Date(),
  random: RandomSource = Math.random
): RoomNodeDeviceChanges[] {
  const changedDeviceIdsByRoom = new Map<string, string[]>();
  const snapshot = store.getSnapshot(now);

  for (const room of snapshot.rooms) {
    for (const device of room.devices) {
      const transitionChance = room.roomId === "drawing" ? 0.18 : 0.32;
      if (random() > transitionChance) {
        continue;
      }

      const desiredStatus = random() < onProbability(device.roomId, device.type) ? "on" : "off";
      const before = device.status;
      store.setDeviceStatus(device.id, desiredStatus, now);
      store.refreshVariablePowerForRoom(device.roomId, now);

      if (before !== desiredStatus) {
        const changedDeviceIds = changedDeviceIdsByRoom.get(device.roomId) ?? [];
        changedDeviceIds.push(device.id);
        changedDeviceIdsByRoom.set(device.roomId, changedDeviceIds);
      }
    }
  }

  return [...changedDeviceIdsByRoom.entries()].map(([roomId, changedDeviceIds]) => ({ roomId, changedDeviceIds }));
}

export const applyOfficePattern = applyAutoPattern;

export function applyForgottenDevicesPreset(store: SimulatorStateStore, now = new Date()): RoomNodeDeviceChanges[] {
  store.setAllStatus("off", now);
  store.setDeviceStatus("work1-fan-1", "on", now);
  store.setDeviceStatus("work1-light-1", "on", now);
  store.setDeviceStatus("work2-light-2", "on", now);
  return [
    { roomId: "work1", changedDeviceIds: ["work1-fan-1", "work1-light-1"] },
    { roomId: "work2", changedDeviceIds: ["work2-light-2"] }
  ];
}

export function isOfficeHours(now: Date, timezone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false
    }).format(now)
  );

  return hour >= 9 && hour < 17;
}

function onProbability(roomId: string, type: string): number {
  if (roomId === "drawing") {
    return type === "fan" ? 0.22 : 0.18;
  }

  return type === "fan" ? 0.62 : 0.54;
}

export function statusForBoolean(value: boolean): DeviceStatus {
  return value ? "on" : "off";
}
