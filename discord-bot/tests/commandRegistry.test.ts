import assert from "node:assert/strict";
import test from "node:test";
import type { CommandDefinition, CommandServices } from "../src/commands/commandRegistry.js";
import type { OfficeState, UsageTotals } from "../src/backend/backendTypes.js";

process.env.DISCORD_BOT_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client";
process.env.BACKEND_URL = "http://localhost:4000";
process.env.GEMINI_MODEL = "gemini-flash-latest";

test("registers all required Discord commands", async () => {
  const { commandDefinitions } = await import("../src/commands/commandRegistry.ts");
  const names = commandDefinitions.map((command) => command.name).sort();
  assert.deepEqual(names, [
    "alerts",
    "bot-config",
    "device",
    "devices",
    "health",
    "help",
    "nodes",
    "pending",
    "room",
    "status",
    "top",
    "usage",
    "visual",
    "waste"
  ].sort());
});

test("defaults Gemini model to the latest Flash alias", async () => {
  const { config } = await import("../src/config.ts");
  assert.equal(config.GEMINI_MODEL, "gemini-flash-latest");
});

test("required commands are promoted in help output", async () => {
  const { helpEmbed } = await import("../src/messages/embeds.ts");
  const embed = helpEmbed("!").toJSON();
  const required = embed.fields?.find((field) => field.name === "Required Commands");
  assert.ok(required);
  assert.match(required.value, /!status/);
  assert.match(required.value, /!room <name>/);
  assert.match(required.value, /!usage/);
});

test("status command fetches backend state and treats active nodes as online", async () => {
  const { commandDefinitions } = await import("../src/commands/commandRegistry.ts");
  const command = requiredCommand(commandDefinitions, "status");
  const result = await command.execute({ userId: "user-1", args: [], options: {} }, fakeServices());
  const embed = result.embeds?.[0]?.toJSON();
  const nodes = embed?.fields?.find((field) => field.name === "Nodes");

  assert.equal(embed?.description, "Human office summary.");
  assert.match(nodes?.value ?? "", /1\/1 online/);
});

test("room command resolves natural room names and shows room devices", async () => {
  const { commandDefinitions } = await import("../src/commands/commandRegistry.ts");
  const command = requiredCommand(commandDefinitions, "room");
  const result = await command.execute({ userId: "user-1", args: ["Work1"], options: {} }, fakeServices());
  const embed = result.embeds?.[0]?.toJSON();
  const devices = embed?.fields?.find((field) => field.name === "Device list");

  assert.match(embed?.title ?? "", /Work Room 1/);
  assert.equal(embed?.description, "Human room summary.");
  assert.match(devices?.value ?? "", /Fan 1/);
});

test("usage command fetches summary, room usage, and device usage from backend", async () => {
  const { commandDefinitions } = await import("../src/commands/commandRegistry.ts");
  const services = fakeServices();
  const command = requiredCommand(commandDefinitions, "usage");
  const result = await command.execute({
    userId: "user-1",
    args: [],
    options: { range: "today", room: "Work Room 1" }
  }, services);
  const embed = result.embeds?.[0]?.toJSON();

  assert.equal(embed?.description, "Human usage summary.");
  assert.deepEqual(services.calls, [
    "state",
    "summary:today:room-work1:",
    "rooms:today:room-work1:",
    "devices:today:room-work1:"
  ]);
});

function requiredCommand(commands: CommandDefinition[], name: string): CommandDefinition {
  const command = commands.find((item) => item.name === name);
  assert.ok(command, `${name} command should exist`);
  return command;
}

function fakeServices(): CommandServices & { calls: string[] } {
  const calls: string[] = [];
  const services = {
    calls,
    backend: {
      state: async () => {
        calls.push("state");
        return sampleState();
      },
      usageSummary: async (query: Record<string, string | undefined>) => {
        calls.push(`summary:${query.range ?? ""}:${query.roomId ?? ""}:${query.deviceId ?? ""}`);
        return {
          range: query.range ?? "today",
          start: "2026-07-04T00:00:00.000Z",
          end: "2026-07-04T12:00:00.000Z",
          totals: sampleTotals(1.2, 14.4),
          presets: {}
        };
      },
      roomUsage: async (query: Record<string, string | undefined>) => {
        calls.push(`rooms:${query.range ?? ""}:${query.roomId ?? ""}:${query.deviceId ?? ""}`);
        return {
          range: query.range ?? "today",
          start: "2026-07-04T00:00:00.000Z",
          end: "2026-07-04T12:00:00.000Z",
          rooms: [{ roomId: "room-work1", ...sampleTotals(1.2, 14.4) }]
        };
      },
      deviceUsage: async (query: Record<string, string | undefined>) => {
        calls.push(`devices:${query.range ?? ""}:${query.roomId ?? ""}:${query.deviceId ?? ""}`);
        return {
          range: query.range ?? "today",
          start: "2026-07-04T00:00:00.000Z",
          end: "2026-07-04T12:00:00.000Z",
          devices: [{ deviceId: "device-fan-1", ...sampleTotals(1.2, 14.4) }]
        };
      }
    },
    humanizer: {
      officeStatus: async () => "Human office summary.",
      roomStatus: async () => "Human room summary.",
      usageSummary: async () => "Human usage summary."
    },
    guildStore: {}
  } as unknown as CommandServices & { calls: string[] };
  return services;
}

function sampleState(): OfficeState {
  return {
    nodes: [{ id: "node-1", nodeId: "room-node-work1", roomId: "room-work1", status: "active", lastSeenAt: "2026-07-04T12:00:00.000Z", lastSequence: 4 }],
    pendingNodes: [],
    rooms: [{
      roomId: "room-work1",
      name: "Work Room 1",
      description: "Main work room",
      deviceCount: 1,
      activeDeviceCount: 1,
      currentPowerWatts: 60,
      approxCurrentAmps: 0.273,
      averageVoltageVolts: 220,
      unitKwhToday: 1.2,
      costBdtToday: 14.4,
      officeTimeUnitKwhToday: 1.2,
      officeTimeCostBdtToday: 14.4,
      offTimeUnitKwhToday: 0,
      offTimeCostBdtToday: 0
    }],
    devices: [{
      id: "device-fan-1",
      externalDeviceId: "fan-1",
      name: "Fan 1",
      type: "fan",
      roomId: "room-work1",
      nodeId: "room-node-work1",
      status: "on",
      voltageVolts: 220,
      currentAmps: 0.273,
      powerWatts: 60,
      expectedPowerWatts: 60,
      unitKwhToday: 1.2,
      costBdtToday: 14.4,
      officeTimeUnitKwhToday: 1.2,
      officeTimeCostBdtToday: 14.4,
      offTimeUnitKwhToday: 0,
      offTimeCostBdtToday: 0,
      lastChangedAt: "2026-07-04T10:00:00.000Z",
      onSince: "2026-07-04T10:00:00.000Z",
      onDurationSeconds: 7200
    }],
    unassignedDevices: [],
    officeSummary: {
      currentPowerWatts: 60,
      approxCurrentAmps: 0.273,
      averageVoltageVolts: 220,
      unitKwhToday: 1.2,
      costBdtToday: 14.4,
      unitKwhThisMonth: 1.2,
      costBdtThisMonth: 14.4,
      estimatedMonthlyBillBdt: 14.4,
      officeTimeUnitKwhToday: 1.2,
      officeTimeCostBdtToday: 14.4,
      offTimeUnitKwhToday: 0,
      offTimeCostBdtToday: 0
    },
    activeAlerts: [],
    settings: {
      officeStartTime: "09:00",
      officeEndTime: "18:00",
      timezone: "Asia/Dhaka",
      bdtPerUnitKwh: 12,
      defaultAlertRepeatMinutes: 120,
      heartbeatTimeoutSeconds: 20
    }
  };
}

function sampleTotals(unitKwh: number, costBdt: number): UsageTotals {
  return {
    unitKwh,
    costBdt,
    officeTimeUnitKwh: unitKwh,
    officeTimeCostBdt: costBdt,
    offTimeUnitKwh: 0,
    offTimeCostBdt: 0,
    averagePowerWatts: 60,
    averageVoltageVolts: 220,
    averageCurrentAmps: 0.273
  };
}
