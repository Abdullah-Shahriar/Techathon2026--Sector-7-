import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { LogLevel, SimulatorConfig } from "./types.js";
import { DEFAULT_TIMEZONE } from "./types.js";

const DEFAULTS = {
  BACKEND_URL: "http://localhost:4000",
  IOT_TELEMETRY_PATH: "/api/iot/telemetry",
  DEVICE_API_KEY: "dev-device-key",
  SIMULATOR_CONTROL_PORT: "5100",
  TICK_INTERVAL_MS: "3000",
  HEARTBEAT_INTERVAL_MS: "5000",
  AUTO_START: "true",
  DRY_RUN: "false",
  TIMEZONE: DEFAULT_TIMEZONE,
  LOG_LEVEL: "info"
} as const;

type EnvMap = Record<string, string | undefined>;

export function readEnvFile(filePath = path.resolve(process.cwd(), ".env")): EnvMap {
  if (!existsSync(filePath)) {
    return {};
  }

  const env: EnvMap = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(rawValue);
  }

  return env;
}

export function loadConfig(
  argv = process.argv.slice(2),
  env: EnvMap = process.env,
  cwd = process.cwd()
): SimulatorConfig {
  const fileEnv = readEnvFile(path.resolve(cwd, ".env"));
  const merged: EnvMap = { ...DEFAULTS, ...fileEnv, ...definedOnly(env) };
  const flags = parseCliFlags(argv);

  const backendUrl = stripTrailingSlash(flags.BACKEND_URL ?? merged.BACKEND_URL ?? DEFAULTS.BACKEND_URL);
  const telemetryPath = ensureLeadingSlash(
    flags.IOT_TELEMETRY_PATH ?? merged.IOT_TELEMETRY_PATH ?? DEFAULTS.IOT_TELEMETRY_PATH
  );
  const logLevel = normalizeLogLevel(flags.LOG_LEVEL ?? merged.LOG_LEVEL ?? DEFAULTS.LOG_LEVEL);

  return {
    backendUrl,
    telemetryPath,
    telemetryUrl: `${backendUrl}${telemetryPath}`,
    deviceApiKey: flags.DEVICE_API_KEY ?? merged.DEVICE_API_KEY ?? DEFAULTS.DEVICE_API_KEY,
    controlPort: positiveInteger(
      flags.SIMULATOR_CONTROL_PORT ?? merged.SIMULATOR_CONTROL_PORT,
      Number(DEFAULTS.SIMULATOR_CONTROL_PORT),
      "SIMULATOR_CONTROL_PORT"
    ),
    tickIntervalMs: positiveInteger(
      flags.TICK_INTERVAL_MS ?? merged.TICK_INTERVAL_MS,
      Number(DEFAULTS.TICK_INTERVAL_MS),
      "TICK_INTERVAL_MS"
    ),
    heartbeatIntervalMs: positiveInteger(
      flags.HEARTBEAT_INTERVAL_MS ?? merged.HEARTBEAT_INTERVAL_MS,
      Number(DEFAULTS.HEARTBEAT_INTERVAL_MS),
      "HEARTBEAT_INTERVAL_MS"
    ),
    autoStart: parseBoolean(flags.AUTO_START ?? merged.AUTO_START ?? DEFAULTS.AUTO_START),
    dryRun: parseBoolean(flags.DRY_RUN ?? merged.DRY_RUN ?? DEFAULTS.DRY_RUN),
    timezone: flags.TIMEZONE ?? merged.TIMEZONE ?? DEFAULTS.TIMEZONE,
    logLevel
  };
}

function parseCliFlags(argv: string[]): EnvMap {
  const flags: EnvMap = {};

  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--dry") {
      flags.DRY_RUN = "true";
      continue;
    }

    if (arg === "--live") {
      flags.DRY_RUN = "false";
      continue;
    }

    if (arg === "--no-auto-start") {
      flags.AUTO_START = "false";
      continue;
    }

    const match = arg.match(/^--([a-z0-9-]+)=(.*)$/i);
    if (!match) {
      continue;
    }

    const key = match[1]?.replaceAll("-", "_").toUpperCase();
    const value = match[2];
    if (key) {
      flags[key] = value;
    }
  }

  return flags;
}

function definedOnly(env: EnvMap): EnvMap {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  if (value !== undefined) {
    throw new Error(`${name} must be a positive integer`);
  }

  return fallback;
}

function normalizeLogLevel(value: string): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}
