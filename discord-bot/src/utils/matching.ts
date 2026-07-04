import type { DeviceSummary, RoomSummary } from "../backend/backendTypes.js";
import { FriendlyError } from "./errors.js";
import { truncate } from "./format.js";

export interface RoomLike {
  _id?: string | null;
  id?: string | null;
  roomId?: string | null;
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
}

export interface DeviceLike {
  _id?: string | null;
  id?: string | null;
  externalDeviceId?: string | null;
  name?: string | null;
  displayName?: string | null;
  roomId?: string | null;
}

export function cleanUserArgument(value: string | undefined | null): string {
  if (!value) return "";
  let cleaned = value.trim();
  while (cleaned.startsWith("<") && cleaned.endsWith(">") && cleaned.length > 1) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/\s+/g, " ");
}

export function compactKey(value: string | undefined | null): string {
  return cleanUserArgument(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\broom\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function spacedKey(value: string | undefined | null): string {
  return cleanUserArgument(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\broom\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function roomAliases(room: RoomLike): string[] {
  const seeds = [
    room.roomId,
    room.id,
    room._id,
    room.name,
    room.displayName,
    room.description
  ].filter((value): value is string => Boolean(value?.trim()));
  const aliases = new Set<string>();
  for (const seed of seeds) {
    aliases.add(seed);
    aliases.add(seed.replace(/\bwork\s*room\s*(\d+)\b/i, "work$1"));
    aliases.add(seed.replace(/\bwork\s*(\d+)\b/i, "work$1"));
    aliases.add(seed.replace(/\bdrawing\s*room\b/i, "drawing"));
  }
  return [...aliases].filter(Boolean);
}

export function deviceAliases(device: DeviceLike): string[] {
  return [device.id, device._id, device.externalDeviceId, device.name, device.displayName]
    .filter((value): value is string => Boolean(value?.trim()));
}

export function findBestRoom<T extends RoomLike>(rooms: T[], query: string): { room: T | null; suggestion: T | null } {
  const cleaned = cleanUserArgument(query);
  const compact = compactKey(cleaned);
  const spaced = spacedKey(cleaned);
  if (!compact && !spaced) return { room: null, suggestion: null };

  for (const room of rooms) {
    const aliases = roomAliases(room);
    if (aliases.some((alias) => compactKey(alias) === compact || spacedKey(alias) === spaced)) {
      return { room, suggestion: null };
    }
  }

  for (const room of rooms) {
    const aliases = roomAliases(room);
    if (aliases.some((alias) => compactKey(alias).includes(compact) || compact.includes(compactKey(alias)))) {
      return { room, suggestion: null };
    }
  }

  const scored = rooms
    .map((room) => ({ room, score: Math.max(...roomAliases(room).map((alias) => similarity(compact, compactKey(alias)))) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { room: best && best.score >= 0.58 ? best.room : null, suggestion: best?.room ?? null };
}

export function findBestDevice<T extends DeviceLike>(devices: T[], query: string): { device: T | null; suggestion: T | null } {
  const cleaned = cleanUserArgument(query);
  const compact = compactKey(cleaned);
  if (!compact) return { device: null, suggestion: null };

  for (const device of devices) {
    if (deviceAliases(device).some((alias) => compactKey(alias) === compact)) {
      return { device, suggestion: null };
    }
  }
  for (const device of devices) {
    if (deviceAliases(device).some((alias) => compactKey(alias).includes(compact) || compact.includes(compactKey(alias)))) {
      return { device, suggestion: null };
    }
  }
  const scored = devices
    .map((device) => ({ device, score: Math.max(...deviceAliases(device).map((alias) => similarity(compact, compactKey(alias)))) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { device: best && best.score >= 0.58 ? best.device : null, suggestion: best?.device ?? null };
}

export function requireRoom(rooms: RoomSummary[], query: string): RoomSummary {
  const { room, suggestion } = findBestRoom(rooms, query);
  if (room) return room;
  const available = rooms.map(roomDisplayName).join(", ") || "none";
  const hint = suggestion ? ` Did you mean ${roomDisplayName(suggestion)}?` : "";
  throw new FriendlyError(`I could not find "${cleanUserArgument(query)}". Available rooms: ${available}.${hint}`);
}

export function requireDevice(devices: DeviceSummary[], query: string): DeviceSummary {
  const { device, suggestion } = findBestDevice(devices, query);
  if (device) return device;
  const available = truncate(devices.slice(0, 8).map((item) => item.externalDeviceId || item.name).join(", "), 180) || "none";
  const hint = suggestion ? ` Did you mean ${suggestion.name ?? suggestion.externalDeviceId}?` : "";
  throw new FriendlyError(`I could not find "${cleanUserArgument(query)}". Try one of: ${available}.${hint}`);
}

export function roomDisplayName(room: RoomLike): string {
  return room.name ?? room.displayName ?? room.roomId ?? room.id ?? room._id ?? "Unnamed room";
}

export function deviceDisplayName(device: DeviceLike): string {
  return device.name ?? device.displayName ?? device.externalDeviceId ?? device.id ?? device._id ?? "Unnamed device";
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let last = i - 1;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = previous[j] ?? 0;
      previous[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      last = old;
    }
  }
  return previous[b.length] ?? 0;
}
