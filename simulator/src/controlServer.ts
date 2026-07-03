import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { ROOM_NODES } from "./deviceCatalog.js";
import { applyForgottenDevicesPreset } from "./scenarios.js";
import type { Logger } from "./logger.js";
import type { SimulationEngine } from "./simulationEngine.js";
import type { DeviceStatus, MeasurementProfile, SimulatorConfig } from "./types.js";
import type { SimulatorStateStore } from "./stateStore.js";

interface ControlServerDependencies {
  config: SimulatorConfig;
  store: SimulatorStateStore;
  engine: SimulationEngine;
  logger: Logger;
}

const publicFiles: Record<string, { filename: string; contentType: string }> = {
  "/": { filename: "index.html", contentType: "text/html; charset=utf-8" },
  "/index.html": { filename: "index.html", contentType: "text/html; charset=utf-8" },
  "/styles.css": { filename: "styles.css", contentType: "text/css; charset=utf-8" },
  "/app.js": { filename: "app.js", contentType: "application/javascript; charset=utf-8" }
};
const measurementProfiles = new Set<MeasurementProfile>(["rated", "low", "max", "variable", "custom"]);

export class ControlServer {
  private readonly server: http.Server;

  constructor(private readonly dependencies: ControlServerDependencies) {
    this.server = http.createServer((request, response) => {
      void this.handleRequest(request, response).catch((error) => {
        this.dependencies.logger.error("Control API request failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        sendJson(response, 500, { ok: false, error: "Internal server error" });
      });
    });
  }

  start(): Promise<void> {
    if (this.server.listening) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        this.server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        this.server.off("error", onError);
        this.dependencies.logger.info("Control API listening", {
          port: this.dependencies.config.controlPort
        });
        resolve();
      };

      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.dependencies.config.controlPort);
    });
  }

  stop(): Promise<void> {
    if (!this.server.listening) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async handleRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const method = request.method ?? "GET";

    if (method === "GET" && publicFiles[url.pathname]) {
      await servePublicFile(response, url.pathname);
      return;
    }

    if (method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (method === "GET" && url.pathname === "/health") {
      const telemetry = this.dependencies.engine.getTelemetryStatus();
      sendJson(response, 200, {
        ok: true,
        service: "officepulse-simulator",
        paused: this.dependencies.store.isSimulationPaused(),
        mode: this.dependencies.store.getSimulationMode(),
        status: this.dependencies.store.getSimulationMode() === "manual"
          ? "manual"
          : this.dependencies.store.isSimulationPaused()
            ? "auto-paused"
            : "auto-running",
        dryRun: this.dependencies.config.dryRun,
        backendUrl: this.dependencies.config.backendUrl,
        telemetryEndpoint: this.dependencies.config.telemetryPath,
        telemetryUrl: this.dependencies.config.telemetryUrl,
        tickIntervalMs: this.dependencies.config.tickIntervalMs,
        heartbeatIntervalMs: this.dependencies.config.heartbeatIntervalMs,
        backendConnection: telemetry.backendConnection,
        lastTelemetrySentAt: telemetry.lastTelemetrySentAt,
        lastResult: telemetry.lastResult
      });
      return;
    }

    if (method === "GET" && url.pathname === "/state") {
      const snapshot = this.dependencies.store.getSnapshot();
      sendJson(response, 200, {
        ...snapshot,
        runtime: {
          status: snapshot.simulationMode === "manual"
            ? "manual"
            : snapshot.simulationPaused
              ? "auto-paused"
              : "auto-running",
          mode: snapshot.simulationMode,
          autoPaused: snapshot.simulationPaused,
          backendTargetUrl: this.dependencies.config.backendUrl,
          telemetryEndpoint: this.dependencies.config.telemetryPath,
          telemetryUrl: this.dependencies.config.telemetryUrl,
          tickIntervalMs: this.dependencies.config.tickIntervalMs,
          heartbeatIntervalMs: this.dependencies.config.heartbeatIntervalMs,
          dryRun: this.dependencies.config.dryRun
        },
        telemetry: this.dependencies.engine.getTelemetryStatus()
      });
      return;
    }

    if (method === "GET" && url.pathname === "/telemetry/latest") {
      sendJson(response, 200, {
        ok: true,
        telemetry: this.dependencies.engine.getTelemetryStatus()
      });
      return;
    }

    if (method !== "POST" && method !== "PATCH") {
      sendJson(response, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(request);

    try {
      await this.routeMutation(method, segments, body, response);
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async routeMutation(
    method: string,
    segments: string[],
    body: Record<string, unknown> | undefined,
    response: http.ServerResponse
  ): Promise<void> {
    const { store, engine } = this.dependencies;
    const now = new Date();

    if (method === "PATCH" && segments[0] === "devices" && segments[1] && segments[2] === "state" && segments.length === 3) {
      const deviceId = segments[1];
      const requestedStatus = String(body?.status ?? "");
      const before = store.getDevice(deviceId);
      let device;

      if (requestedStatus === "toggle") {
        device = store.toggleDevice(deviceId, now);
      } else if (requestedStatus === "on" || requestedStatus === "off") {
        device = store.setDeviceStatus(deviceId, requestedStatus, now);
      } else {
        throw new Error("status must be on, off, or toggle");
      }

      const changedDeviceIds = before?.status === device.status ? [] : [device.id];
      engine.recordEvent("manual-control", `${device.name} switched ${device.status.toUpperCase()}`, {
        deviceId,
        status: device.status
      });
      const telemetry = await engine.sendRoomTelemetry(device.roomId, "state_change", changedDeviceIds);
      sendJson(response, 200, { ok: true, device, telemetry });
      return;
    }

    if (method === "POST" && segments[0] === "devices" && segments[1] && segments.length === 3) {
      const deviceId = segments[1];
      const action = segments[2];
      if (action === "toggle") {
        const before = store.getDevice(deviceId);
        const device = store.toggleDevice(deviceId, now);
        engine.recordEvent("manual-control", `Toggled ${device.name}`, {
          deviceId,
          status: device.status
        });
        const telemetry = await engine.sendRoomTelemetry(
          device.roomId,
          "state_change",
          before?.status === device.status ? [] : [device.id]
        );
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }

      if (action === "on" || action === "off") {
        const before = store.getDevice(deviceId);
        const device = store.setDeviceStatus(deviceId, action, now);
        engine.recordEvent("manual-control", `Forced ${device.name} ${action.toUpperCase()}`, {
          deviceId,
          status: device.status
        });
        const telemetry = await engine.sendRoomTelemetry(
          device.roomId,
          "state_change",
          before?.status === device.status ? [] : [device.id]
        );
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }
    }

    if (method === "PATCH" && segments[0] === "devices" && segments[1] && segments.length === 3) {
      const deviceId = segments[1];
      const action = segments[2];

      if (action === "rated-wattage") {
        const device = store.setDeviceWattage(deviceId, {
          ratedPowerWatts: numberFromBody(body, "ratedPowerWatts"),
          reset: Boolean(body?.reset)
        }, now);
        engine.recordEvent("manual-control", `Updated ${device.name} rated wattage`, {
          deviceId,
          ratedPowerWatts: device.ratedPowerWatts
        });
        const telemetry = await engine.sendRoomTelemetry(device.roomId, "state_change", [device.id]);
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }

      if (action === "custom-power") {
        const device = store.setDeviceWattage(deviceId, {
          customPowerWatts: nullableNumberFromBody(body, "customPowerWatts")
        }, now);
        engine.recordEvent("manual-control", `Updated ${device.name} custom power`, {
          deviceId,
          customPowerWatts: device.customPowerWatts
        });
        const telemetry = await engine.sendRoomTelemetry(device.roomId, "state_change", [device.id]);
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }

      if (action === "measurement-profile") {
        const measurementProfile = String(body?.measurementProfile ?? "");
        if (!measurementProfiles.has(measurementProfile as MeasurementProfile)) {
          throw new Error("measurementProfile must be rated, low, max, variable, or custom");
        }

        const device = store.setDeviceMeasurementProfile(deviceId, measurementProfile as MeasurementProfile, now);
        engine.recordEvent("manual-control", `Updated ${device.name} measurement profile`, {
          deviceId,
          measurementProfile: device.measurementProfile
        });
        const telemetry = await engine.sendRoomTelemetry(device.roomId, "state_change", [device.id]);
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }

      if (action === "wattage") {
        const device = store.setDeviceWattage(deviceId, {
          ratedPowerWatts: numberFromBody(body, "ratedPowerWatts"),
          customPowerWatts: nullableNumberFromBody(body, "customPowerWatts"),
          reset: Boolean(body?.reset)
        }, now);
        engine.recordEvent("manual-control", `Updated ${device.name} wattage`, {
          deviceId,
          ratedPowerWatts: device.ratedPowerWatts,
          customPowerWatts: device.customPowerWatts
        });
        const telemetry = await engine.sendRoomTelemetry(device.roomId, "state_change", [device.id]);
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }

      if (action === "power-mode") {
        const powerMode = String(body?.powerMode ?? "");
        if (!measurementProfiles.has(powerMode as MeasurementProfile)) {
          throw new Error("powerMode must be rated, low, max, variable, or custom");
        }

        const device = store.setDeviceMeasurementProfile(deviceId, powerMode as MeasurementProfile, now);
        engine.recordEvent("manual-control", `Updated ${device.name} power mode`, {
          deviceId,
          measurementProfile: device.measurementProfile
        });
        const telemetry = await engine.sendRoomTelemetry(device.roomId, "state_change", [device.id]);
        sendJson(response, 200, { ok: true, device, telemetry });
        return;
      }
    }

    if (method === "POST" && segments[0] === "rooms" && segments[1] && segments.length === 3) {
      const roomId = segments[1];
      const action = segments[2];
      if (action === "all-on") {
        const changedDeviceIds = changedDeviceIdsForRoomStatus(store, roomId, "on");
        const room = store.setRoomStatus(roomId, "on", now);
        engine.recordEvent("manual-control", `${room.roomName} all ON`, { roomId });
        const telemetry = await engine.sendRoomTelemetry(roomId, "state_change", changedDeviceIds);
        sendJson(response, 200, { ok: true, room, telemetry });
        return;
      }

      if (action === "all-off") {
        const changedDeviceIds = changedDeviceIdsForRoomStatus(store, roomId, "off");
        const room = store.setRoomStatus(roomId, "off", now);
        engine.recordEvent("manual-control", `${room.roomName} all OFF`, { roomId });
        const telemetry = await engine.sendRoomTelemetry(roomId, "state_change", changedDeviceIds);
        sendJson(response, 200, { ok: true, room, telemetry });
        return;
      }
    }

    if (method === "POST" && segments[0] === "nodes" && segments[1] && segments.length === 3) {
      const node = nodeFromNodeId(segments[1]);
      if (!node) {
        throw new Error(`Unknown node id: ${segments[1]}`);
      }

      const action = segments[2];
      if (action === "all-on" || action === "all-off") {
        const status: DeviceStatus = action === "all-on" ? "on" : "off";
        const changedDeviceIds = changedDeviceIdsForRoomStatus(store, node.roomId, status);
        const room = store.setRoomStatus(node.roomId, status, now);
        engine.recordEvent("manual-control", `${node.roomName} ${status === "on" ? "all ON" : "all OFF"}`, {
          nodeId: node.nodeId,
          roomId: node.roomId
        });
        const telemetry = await engine.sendRoomTelemetry(node.roomId, "state_change", changedDeviceIds);
        sendJson(response, 200, { ok: true, room, telemetry });
        return;
      }

      if (action === "send-now") {
        const result = await engine.sendRoomTelemetry(node.roomId, "manual_sync");
        sendJson(response, 200, { ok: result.ok, result });
        return;
      }
    }

    if (method === "POST" && segments[0] === "preset" && segments[1] === "forgotten-devices" && segments.length === 2) {
      const roomChanges = applyForgottenDevicesPreset(store, now);
      engine.recordEvent("manual-control", "Forgotten devices preset applied", {
        changedRoomIds: roomChanges.map((change) => change.roomId).join(", ")
      });
      const results = [];
      for (const change of roomChanges) {
        results.push(await engine.sendRoomTelemetry(change.roomId, "state_change", change.changedDeviceIds));
      }
      sendJson(response, 200, { ok: results.every((result) => result.ok), results, state: store.getSnapshot(now) });
      return;
    }

    if (method === "POST" && segments[0] === "simulation" && segments.length === 3 && segments[1] === "mode") {
      if (segments[2] === "manual" || segments[2] === "auto") {
        engine.setMode(segments[2]);
        sendJson(response, 200, {
          ok: true,
          mode: store.getSimulationMode(),
          autoPaused: store.isSimulationPaused()
        });
        return;
      }
    }

    if (method === "POST" && segments[0] === "simulation" && segments.length === 2) {
      if (segments[1] === "pause") {
        engine.pause();
        sendJson(response, 200, {
          ok: true,
          mode: store.getSimulationMode(),
          autoPaused: store.isSimulationPaused()
        });
        return;
      }

      if (segments[1] === "resume") {
        engine.resume();
        sendJson(response, 200, {
          ok: true,
          mode: store.getSimulationMode(),
          autoPaused: store.isSimulationPaused()
        });
        return;
      }

      if (segments[1] === "reset") {
        engine.reset();
        sendJson(response, 200, { ok: true, state: store.getSnapshot() });
        return;
      }
    }

    if (
      method === "POST"
      && segments[0] === "telemetry"
      && (segments[1] === "send-now" || segments[1] === "send-all-now")
      && segments.length === 2
    ) {
      const results = await engine.sendTelemetryNow();
      sendJson(response, 200, { ok: results.every((result) => result.ok), results });
      return;
    }

    if (method === "POST" && segments[0] === "telemetry" && segments[1] === "send-room" && segments[2] && segments.length === 3) {
      const result = await engine.sendRoomTelemetry(segments[2], "manual_sync");
      sendJson(response, 200, { ok: result.ok, result });
      return;
    }

    sendJson(response, 404, { ok: false, error: "Route not found" });
  }
}

async function servePublicFile(response: http.ServerResponse, pathname: string): Promise<void> {
  const file = publicFiles[pathname];
  if (!file) {
    sendJson(response, 404, { ok: false, error: "Static file not found" });
    return;
  }

  const publicDir = path.resolve(process.cwd(), "public");
  const filePath = path.join(publicDir, file.filename);
  const body = await readFile(filePath);

  response.writeHead(200, {
    "Content-Type": file.contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  for await (const _chunk of request) {
    chunks.push(Buffer.isBuffer(_chunk) ? _chunk : Buffer.from(_chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return undefined;
  }

  const parsed = JSON.parse(rawBody) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function numberFromBody(body: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!body || body[key] === undefined) {
    return undefined;
  }

  const value = Number(body[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }

  return value;
}

function nullableNumberFromBody(body: Record<string, unknown> | undefined, key: string): number | null | undefined {
  if (!body || body[key] === undefined) {
    return undefined;
  }

  if (body[key] === null || body[key] === "") {
    return null;
  }

  const value = Number(body[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number or null`);
  }

  return value;
}

function nodeFromNodeId(nodeId: string) {
  return ROOM_NODES.find((node) => node.nodeId === nodeId);
}

function changedDeviceIdsForRoomStatus(
  store: SimulatorStateStore,
  roomId: string,
  status: DeviceStatus
): string[] {
  return store.getRoomState(roomId).devices
    .filter((device) => device.status !== status)
    .map((device) => device.id);
}
