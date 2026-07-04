import type {
  AlertSetting,
  AlertTypeMetadata,
  ApiEnvelope,
  AuditLog,
  DeviceUsageResponse,
  ManagedDevice,
  ManagedRoom,
  OfficeState,
  RoomUsageResponse,
  TimelineResponse,
  UsageFilters,
  UsageSummaryResponse,
  VisualizerLayout
} from "./types";

export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, { cache: "no-store" });
  const json = await readEnvelope<T>(response);
  if (!response.ok || !json?.ok) {
    throw new Error(json && !json.ok ? json.error.message : response.statusText);
  }
  return json.data;
}

export function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  return sendBody<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown = {}): Promise<T> {
  return sendBody<T>("PATCH", path, body);
}

async function sendBody<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await readEnvelope<T>(response).catch(() => null);
  if (!response.ok || !json?.ok) {
    throw new Error(json && !json.ok ? json.error.message : response.statusText);
  }
  return json.data;
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(text.slice(0, 220).trim() || response.statusText);
  }
}

export function usageQuery(filters: UsageFilters): { summary: string; timeline: string } {
  const summary = new URLSearchParams();
  const startIso = toIsoDateTime(filters.start);
  const endIso = toIsoDateTime(filters.end);
  summary.set("range", filters.range === "custom" || startIso || endIso ? "custom" : filters.range);
  if (startIso) summary.set("start", startIso);
  if (endIso) summary.set("end", endIso);
  if (filters.roomId) summary.set("roomId", filters.roomId);
  if (filters.deviceId) summary.set("deviceId", filters.deviceId);

  const timeline = new URLSearchParams(summary);
  timeline.set("groupBy", filters.groupBy);
  if (filters.groupBy === "custom") {
    timeline.set("intervalSeconds", String(Math.max(1, filters.intervalSeconds || 1)));
  }
  return { summary: summary.toString(), timeline: timeline.toString() };
}

function toIsoDateTime(value: string): string {
  if (!value.trim()) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export const api = {
  state: () => apiGet<OfficeState>("/api/state"),
  alertSettings: () => apiGet<AlertSetting[]>("/api/alerts/settings"),
  alertTypes: () => apiGet<AlertTypeMetadata[]>("/api/alerts/types"),
  managedRooms: () => apiGet<ManagedRoom[]>("/api/rooms?includeInactive=true"),
  managedDevices: () => apiGet<ManagedDevice[]>("/api/devices?includeInactive=true"),
  auditLogs: () => apiGet<AuditLog[]>("/api/audit-logs?limit=20"),
  usageSummary: (filters: UsageFilters) => apiGet<UsageSummaryResponse>(`/api/usage/summary?${usageQuery(filters).summary}`),
  roomUsage: (filters: UsageFilters) => apiGet<RoomUsageResponse>(`/api/usage/rooms?${usageQuery(filters).summary}`),
  deviceUsage: (filters: UsageFilters) => apiGet<DeviceUsageResponse>(`/api/usage/devices?${usageQuery(filters).summary}`),
  timeline: (filters: UsageFilters) => apiGet<TimelineResponse>(`/api/usage/timeline?${usageQuery(filters).timeline}`),
  alerts: (status?: string) => apiGet<unknown[]>(`/api/alerts${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  acknowledgeAlert: (id: string) => apiPatch<unknown>(`/api/alerts/${id}/acknowledge`, {}),
  resolveAlert: (id: string) => apiPatch<unknown>(`/api/alerts/${id}/resolve`, {}),
  alertOccurrences: (id: string) => apiGet<unknown[]>(`/api/alerts/${id}/occurrences`),
  updateSettings: (body: unknown) => apiPatch<unknown>("/api/settings", body),
  updateAlertSettings: (body: unknown) => apiPatch<unknown>("/api/alerts/settings", body),
  visualizerLayout: () => apiGet<VisualizerLayout>("/api/visualizer/layout"),
  saveVisualizerLayout: (body: VisualizerLayout) => apiPatch<VisualizerLayout>("/api/visualizer/layout", body)
};
