import { ROOM_NODES } from "./deviceCatalog.js";
import { applyAutoPattern } from "./scenarios.js";
import type { Logger } from "./logger.js";
import type {
  SendResult,
  SimulationMode,
  SimulatorConfig,
  SimulatorEvent,
  SimulatorEventType,
  TelemetryEventType,
  TelemetryPayload,
  TelemetryStatus
} from "./types.js";
import type { SimulatorStateStore } from "./stateStore.js";
import type { TelemetryClient } from "./telemetryClient.js";

export class SimulationEngine {
  private autoTimer: ReturnType<typeof setInterval> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;
  private readonly latestPayloadByRoom = new Map<string, TelemetryPayload>();
  private readonly lastResultByRoom = new Map<string, SendResult>();
  private lastTelemetrySentAt: string | null = null;
  private readonly events: SimulatorEvent[] = [];
  private nextEventId = 1;

  constructor(
    private readonly config: SimulatorConfig,
    private readonly store: SimulatorStateStore,
    private readonly telemetryClient: TelemetryClient,
    private readonly logger: Logger
  ) {}

  start(): void {
    if (this.autoTimer || this.heartbeatTimer) {
      return;
    }

    this.store.setSimulationMode("manual");
    this.autoTimer = setInterval(() => {
      void this.tick();
    }, this.config.tickIntervalMs);
    this.heartbeatTimer = setInterval(() => {
      void this.sendAllTelemetry("heartbeat");
    }, this.config.heartbeatIntervalMs);

    this.logger.info("Simulator telemetry engine started", {
      tickIntervalMs: this.config.tickIntervalMs,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      dryRun: this.config.dryRun
    });
    this.recordEvent("system", "Simulator started in Manual Mode", {
      tickIntervalMs: this.config.tickIntervalMs,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      dryRun: this.config.dryRun
    });
    void this.sendAllTelemetry("boot");
  }

  setMode(mode: SimulationMode): void {
    this.store.setSimulationMode(mode);
    this.recordEvent("simulation", `${mode === "auto" ? "Auto" : "Manual"} Mode enabled`);

    if (mode === "auto") {
      void this.tick();
    }
  }

  pause(): void {
    this.store.setSimulationPaused(true);
    this.logger.info("Auto Mode paused");
    this.recordEvent("simulation", "Auto Mode paused");
  }

  resume(): void {
    if (this.store.getSimulationMode() === "manual") {
      this.store.setSimulationMode("auto");
    }

    this.store.setSimulationPaused(false);
    if (!this.autoTimer || !this.heartbeatTimer) {
      this.start();
      return;
    }

    this.logger.info("Auto Mode resumed");
    this.recordEvent("simulation", "Auto Mode resumed");
    void this.tick();
  }

  reset(): void {
    const changedDeviceIdsByRoom = Object.fromEntries(
      ROOM_NODES.map((node) => [
        node.roomId,
        this.store.getRoomState(node.roomId).devices
          .filter((device) => device.status === "on")
          .map((device) => device.id)
      ])
    );
    this.store.reset();
    this.logger.info("Simulation state reset");
    this.recordEvent("simulation", "Simulation state reset");
    void this.sendAllTelemetry("state_change", changedDeviceIdsByRoom);
  }

  stop(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = undefined;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.logger.info("Simulator telemetry engine stopped");
    this.recordEvent("system", "Simulator telemetry engine stopped");
  }

  async sendTelemetryNow(): Promise<SendResult[]> {
    return this.sendAllTelemetry("manual_sync");
  }

  async sendRoomTelemetry(
    roomId: string,
    eventType: TelemetryEventType,
    changedDeviceIds: string[] = []
  ): Promise<SendResult> {
    this.store.refreshVariablePowerForRoom(roomId);
    const payload = this.store.nextTelemetryPayload(
      roomId,
      eventType,
      changedDeviceIds
    );
    const result = await this.telemetryClient.sendPayload(payload, roomId);
    this.latestPayloadByRoom.set(roomId, payload);
    this.lastResultByRoom.set(roomId, result);
    this.lastTelemetrySentAt = new Date().toISOString();
    this.recordEvent(result.ok ? "telemetry" : "error", `${roomNameForRoomId(roomId)} telemetry sent`, {
      eventType,
      sequence: payload.sequence,
      changedDeviceIds: changedDeviceIds.join(", "),
      dryRun: this.config.dryRun
    });

    return result;
  }

  async sendAllTelemetry(
    eventType: TelemetryEventType,
    changedDeviceIdsByRoom: Record<string, string[]> = {}
  ): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const node of ROOM_NODES) {
      results.push(await this.sendRoomTelemetry(
        node.roomId,
        eventType,
        changedDeviceIdsByRoom[node.roomId] ?? []
      ));
    }

    return results;
  }

  async tick(): Promise<SendResult[] | undefined> {
    if (this.store.getSimulationMode() !== "auto" || this.store.isSimulationPaused() || this.ticking) {
      return undefined;
    }

    this.ticking = true;
    try {
      const now = new Date();
      const roomChanges = applyAutoPattern(this.store, now);
      if (roomChanges.length === 0) {
        this.recordEvent("simulation", "Auto Mode tick with no physical device changes");
        return [];
      }

      this.recordEvent("simulation", "Auto Mode changed simulated physical devices", {
        changedRoomIds: roomChanges.map((change) => change.roomId).join(", ")
      });

      const results: SendResult[] = [];
      for (const change of roomChanges) {
        results.push(await this.sendRoomTelemetry(change.roomId, "state_change", change.changedDeviceIds));
      }

      return results;
    } finally {
      this.ticking = false;
    }
  }

  getTelemetryStatus(): TelemetryStatus {
    const latestPayloads = ROOM_NODES.flatMap((node) => {
      const payload = this.latestPayloadByRoom.get(node.roomId);
      return payload ? [payload] : [];
    });
    const lastResults = ROOM_NODES.flatMap((node) => {
      const result = this.lastResultByRoom.get(node.roomId);
      return result ? [result] : [];
    });
    const lastResult = lastResults.at(-1) ?? null;
    let backendConnection: TelemetryStatus["backendConnection"] = "idle";

    if (lastResults.length > 0) {
      if (this.config.dryRun) {
        backendConnection = "dry-run";
      } else {
        backendConnection = lastResults.every((result) => result.ok) ? "ok" : "error";
      }
    }

    return {
      backendTargetUrl: this.config.backendUrl,
      telemetryEndpoint: this.config.telemetryPath,
      telemetryUrl: this.config.telemetryUrl,
      dryRun: this.config.dryRun,
      tickIntervalMs: this.config.tickIntervalMs,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      lastTelemetrySentAt: this.lastTelemetrySentAt,
      backendConnection,
      latestPayload: latestPayloads[0] ? clonePayload(latestPayloads[0]) : null,
      latestPayloads: latestPayloads.map(clonePayload),
      latestPayloadByRoom: Object.fromEntries(
        ROOM_NODES.map((node) => [
          node.roomId,
          this.latestPayloadByRoom.get(node.roomId)
            ? clonePayload(this.latestPayloadByRoom.get(node.roomId) as TelemetryPayload)
            : null
        ])
      ),
      lastResult: lastResult ? { ...lastResult } : null,
      lastResults: lastResults.map((result) => ({ ...result })),
      lastResultByRoom: Object.fromEntries(
        ROOM_NODES.map((node) => [
          node.roomId,
          this.lastResultByRoom.get(node.roomId) ? { ...(this.lastResultByRoom.get(node.roomId) as SendResult) } : null
        ])
      ),
      events: [...this.events]
    };
  }

  recordEvent(type: SimulatorEventType, message: string, details?: Record<string, unknown>): void {
    this.events.unshift({
      id: this.nextEventId,
      type,
      time: new Date().toISOString(),
      message,
      ...(details ? { details } : {})
    });
    this.nextEventId += 1;

    if (this.events.length > 80) {
      this.events.length = 80;
    }
  }
}

function clonePayload(payload: TelemetryPayload): TelemetryPayload {
  return {
    ...payload,
    changedDeviceIds: [...payload.changedDeviceIds],
    devices: payload.devices.map((device) => ({
      ...device,
      measurements: { ...device.measurements }
    }))
  };
}

function roomNameForRoomId(roomId: string): string {
  return ROOM_NODES.find((node) => node.roomId === roomId)?.roomName ?? roomId;
}
