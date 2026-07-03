import http from "node:http";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";
import type { SimulatorConfig, TelemetryPayload } from "./types.js";

interface MockBackendOptions {
  config: SimulatorConfig;
  logger: Logger;
  port?: number;
}

const receivedPayloads: TelemetryPayload[] = [];

export function startMockBackend(options: MockBackendOptions): Promise<http.Server> {
  const port = options.port ?? portFromBackendUrl(options.config.backendUrl);

  const server = http.createServer((request, response) => {
    void handleRequest(request, response, options.config, options.logger).catch((error) => {
      options.logger.error("Mock backend request failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      sendJson(response, 500, { ok: false, error: "Internal server error" });
    });
  });

  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      options.logger.info("Mock backend listening", {
        port,
        path: options.config.telemetryPath
      });
      resolve(server);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

export function getReceivedTelemetry(): TelemetryPayload[] {
  return receivedPayloads.map((payload) => ({
    ...payload,
    changedDeviceIds: [...payload.changedDeviceIds],
    devices: payload.devices.map((device) => ({
      ...device,
      measurements: { ...device.measurements }
    }))
  }));
}

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  config: SimulatorConfig,
  logger: Logger
): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "officepulse-mock-backend",
      receivedTelemetryCount: receivedPayloads.length
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/telemetry") {
    sendJson(response, 200, {
      ok: true,
      receivedTelemetryCount: receivedPayloads.length,
      payloads: getReceivedTelemetry()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === config.telemetryPath) {
    if (request.headers["x-device-api-key"] !== config.deviceApiKey) {
      sendJson(response, 401, { ok: false, error: "Invalid device API key" });
      return;
    }

    const payload = JSON.parse(await readRequestBody(request)) as TelemetryPayload;
    receivedPayloads.push(payload);
    logger.info("Mock backend received telemetry", {
      nodeId: payload.nodeId,
      sequence: payload.sequence,
      eventType: payload.eventType,
      changedDeviceCount: payload.changedDeviceIds.length
    });
    sendJson(response, 202, { ok: true, receivedTelemetryCount: receivedPayloads.length });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Route not found" });
}

function portFromBackendUrl(backendUrl: string): number {
  const parsed = new URL(backendUrl);
  if (parsed.port) {
    return Number(parsed.port);
  }

  return parsed.protocol === "https:" ? 443 : 80;
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  await startMockBackend({ config, logger });
}
