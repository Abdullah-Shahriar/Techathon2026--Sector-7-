import assert from "node:assert/strict";
import test from "node:test";
import type { RoomSummary } from "../src/backend/backendTypes.js";

process.env.DISCORD_BOT_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client";
process.env.BACKEND_URL = "http://localhost:4000";

const rooms: RoomSummary[] = [
  {
    roomId: "work1",
    name: "Work Room 1",
    description: "Main desk room",
    deviceCount: 2,
    activeDeviceCount: 1,
    currentPowerWatts: 120,
    approxCurrentAmps: 0.55,
    averageVoltageVolts: 220,
    unitKwhToday: 1.2,
    costBdtToday: 14.4,
    officeTimeUnitKwhToday: 1,
    officeTimeCostBdtToday: 12,
    offTimeUnitKwhToday: 0.2,
    offTimeCostBdtToday: 2.4
  },
  {
    roomId: "drawing",
    name: "Drawing Room",
    description: "Guest room",
    deviceCount: 1,
    activeDeviceCount: 0,
    currentPowerWatts: 0,
    approxCurrentAmps: 0,
    averageVoltageVolts: 220,
    unitKwhToday: 0.4,
    costBdtToday: 4.8,
    officeTimeUnitKwhToday: 0.4,
    officeTimeCostBdtToday: 4.8,
    offTimeUnitKwhToday: 0,
    offTimeCostBdtToday: 0
  }
];

test("room lookup accepts required PDF examples and common variants", async () => {
  const { requireRoom } = await import("../src/utils/matching.ts");
  for (const query of ["Work1", "<Work1>", "work1", "WORK1", "Work Room 1", "work 1"]) {
    assert.equal(requireRoom(rooms, query).roomId, "work1", query);
  }
});

test("prefix parser preserves full room names and strips outer brackets", async () => {
  const { parsePrefix } = await import("../src/commands/prefix/prefixRouter.ts");
  assert.deepEqual(parsePrefix("room <Work Room 1>"), {
    name: "room",
    args: ["Work", "Room", "1"],
    rest: "Work Room 1"
  });
});
