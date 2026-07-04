import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeState } from "../src/backend/backendTypes.js";

process.env.DISCORD_BOT_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client";
process.env.BACKEND_URL = "http://localhost:4000";

test("office status humanizer falls back without Gemini", async () => {
  const { Humanizer } = await import("../src/ai/humanizer.ts");
  const humanizer = new Humanizer({ humanize: async () => null } as never);
  const state: OfficeState = {
    nodes: [{ id: "1", nodeId: "room-node-work1", roomId: "work1", status: "online", lastSeenAt: null, lastSequence: 1 }],
    pendingNodes: [],
    rooms: [],
    devices: [],
    unassignedDevices: [],
    activeAlerts: [],
    settings: {
      officeStartTime: "09:00",
      officeEndTime: "18:00",
      timezone: "Asia/Dhaka",
      bdtPerUnitKwh: 12,
      defaultAlertRepeatMinutes: 120,
      heartbeatTimeoutSeconds: 20
    },
    officeSummary: {
      currentPowerWatts: 210,
      approxCurrentAmps: 0.95,
      averageVoltageVolts: 220,
      unitKwhToday: 1.5,
      costBdtToday: 18,
      unitKwhThisMonth: 12,
      costBdtThisMonth: 144,
      estimatedMonthlyBillBdt: 300,
      officeTimeUnitKwhToday: 1,
      officeTimeCostBdtToday: 12,
      offTimeUnitKwhToday: 0.5,
      offTimeCostBdtToday: 6
    }
  };
  const text = await humanizer.officeStatus(state);
  assert.match(text, /210 W/);
  assert.match(text, /BDT 18/);
});
