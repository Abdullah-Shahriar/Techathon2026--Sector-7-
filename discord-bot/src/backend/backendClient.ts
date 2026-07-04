import { config } from "../config.js";
import { FriendlyError } from "../utils/errors.js";
import type {
  AlertSummary,
  ApiEnvelope,
  DeviceUsageResponse,
  HealthResponse,
  ManagedDevice,
  ManagedRoom,
  NodeSummary,
  OfficeState,
  RoomUsageResponse,
  SettingsSummary,
  UsageSummaryResponse
} from "./backendTypes.js";

export interface UsageQuery {
  range?: string;
  start?: string;
  end?: string;
  roomId?: string;
  deviceId?: string;
  limit?: number;
  includePresets?: boolean;
}

export class BackendClient {
  private cache = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(
    private readonly baseUrl = config.BACKEND_URL,
    private readonly apiKey = config.BACKEND_API_KEY,
    private readonly cacheSeconds = config.BACKEND_CACHE_SECONDS,
    private readonly timeoutMs = config.BACKEND_TIMEOUT_MS
  ) {}

  health(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health", { cache: false });
  }

  state(): Promise<OfficeState> {
    return this.get<OfficeState>("/api/state");
  }

  rooms(): Promise<ManagedRoom[]> {
    return this.get<ManagedRoom[]>("/api/rooms?includeInactive=true");
  }

  devices(): Promise<ManagedDevice[]> {
    return this.get<ManagedDevice[]>("/api/devices?includeInactive=true");
  }

  nodes(): Promise<NodeSummary[]> {
    return this.get<NodeSummary[]>("/api/nodes");
  }

  pendingNodes(): Promise<NodeSummary[]> {
    return this.get<NodeSummary[]>("/api/nodes/pending");
  }

  settings(): Promise<SettingsSummary> {
    return this.get<SettingsSummary>("/api/settings");
  }

  alerts(status = "active"): Promise<AlertSummary[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.get<AlertSummary[]>(`/api/alerts${query}`, { cache: false });
  }

  usageSummary(query: UsageQuery = {}): Promise<UsageSummaryResponse> {
    return this.get<UsageSummaryResponse>(`/api/usage/summary?${usageParams({ includePresets: false, ...query })}`);
  }

  roomUsage(query: UsageQuery = {}): Promise<RoomUsageResponse> {
    return this.get<RoomUsageResponse>(`/api/usage/rooms?${usageParams(query)}`);
  }

  deviceUsage(query: UsageQuery = {}): Promise<DeviceUsageResponse> {
    return this.get<DeviceUsageResponse>(`/api/usage/devices?${usageParams(query)}`);
  }

  private async get<T>(path: string, options: { cache?: boolean } = {}): Promise<T> {
    const useCache = options.cache !== false && this.cacheSeconds > 0;
    const cacheKey = path;
    const cached = this.cache.get(cacheKey);
    if (useCache && cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["x-api-key"] = this.apiKey;
      headers["x-device-api-key"] = this.apiKey;
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, { headers });

    const text = await response.text();
    let envelope: ApiEnvelope<T> | null = null;
    try {
      envelope = text ? JSON.parse(text) as ApiEnvelope<T> : null;
    } catch {
      throw new FriendlyError(`Backend returned an unreadable response from ${path} (${response.status}).`);
    }

    if (!response.ok || !envelope?.ok) {
      const message = envelope && !envelope.ok ? envelope.error.message : response.statusText;
      if (response.status === 401) {
        throw new FriendlyError("The backend rejected the bot API key. Set BACKEND_API_KEY in the bot service to the same secret used by the backend API.");
      }
      throw new FriendlyError(`Backend request failed: ${message}`);
    }

    if (useCache) {
      this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheSeconds * 1000, value: envelope.data });
    }
    return envelope.data;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (response.status >= 500 && attempt === 0) {
          lastError = new Error(`Backend returned ${response.status}`);
          await delay(250);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await delay(250);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new FriendlyError(`I cannot reach the OfficePulse backend at ${backendLabel(url)} right now. Make sure the backend service is running and BACKEND_URL points to the public backend URL in production.`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usageParams(query: UsageQuery): string {
  const params = new URLSearchParams();
  params.set("range", query.range ?? "today");
  if (query.start) params.set("start", query.start);
  if (query.end) params.set("end", query.end);
  if (query.roomId) params.set("roomId", query.roomId);
  if (query.deviceId) params.set("deviceId", query.deviceId);
  if (query.includePresets !== undefined) params.set("includePresets", String(query.includePresets));
  return params.toString();
}

function backendLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url;
  }
}
