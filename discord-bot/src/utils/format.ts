import type { DeviceSummary, RoomSummary } from "../backend/backendTypes.js";

export function watts(value: number | null | undefined): string {
  return `${round(value)} W`;
}

export function amps(value: number | null | undefined): string {
  return `${round(value, 3)} A`;
}

export function kwh(value: number | null | undefined): string {
  return `${round(value, 4)} kWh`;
}

export function bdt(value: number | null | undefined): string {
  return `BDT ${round(value, 2)}`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function duration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function statusEmoji(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "on" || normalized === "online" || normalized === "active") return "🟢";
  if (normalized === "off" || normalized === "offline") return "⚪";
  if (normalized === "pending" || normalized === "warning") return "🟡";
  if (normalized === "critical") return "🔴";
  return "•";
}

export function roomLabel(room: RoomSummary | undefined, fallback: string | null | undefined): string {
  return room?.name ?? fallback ?? "Unassigned";
}

export function deviceLabel(device: DeviceSummary): string {
  return `${statusEmoji(device.status)} ${device.name} (${device.externalDeviceId})`;
}

export function round(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0";
  return Number(value.toFixed(digits)).toString();
}

export function truncate(value: string, max = 1024): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}
