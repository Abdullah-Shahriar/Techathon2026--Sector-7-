import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { ROOM_DEFINITIONS } from "../src/deviceCatalog.js";
import { Logger } from "../src/logger.js";
import { SimulationEngine } from "../src/simulationEngine.js";
import { SimulatorStateStore } from "../src/stateStore.js";
import { TelemetryClient } from "../src/telemetryClient.js";

test("telemetry payload exposes only the final ESP32 root fields", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T15:38:00.000Z"));
  store.setDeviceStatus("work1-fan-1", "on", new Date("2026-07-03T15:39:00.000Z"));
  store.setDeviceStatus("work1-light-1", "on", new Date("2026-07-03T15:39:00.000Z"));

  const payload = store.buildTelemetryPayload(
    "work1",
    42,
    "state_change",
    ["work1-fan-1", "work1-light-1"]
  );

  assert.deepEqual(Object.keys(payload).sort(), [
    "changedDeviceIds",
    "devices",
    "eventType",
    "nodeId",
    "schemaVersion",
    "sequence"
  ]);
  assert.equal(payload.schemaVersion, "1.0");
  assert.equal(payload.nodeId, "room-node-work1");
  assert.equal(payload.sequence, 42);
  assert.equal(payload.eventType, "state_change");
  assert.deepEqual(payload.changedDeviceIds, ["work1-fan-1", "work1-light-1"]);
  assert.equal(payload.devices.length, 5);

  const forbiddenRootFields = [
    "sourceType",
    "sentAt",
    "timezone",
    "roomId",
    "roomName",
    "reason",
    "ratedPowerWatts",
    "powerMode",
    "measurementProfile",
    "customPowerWatts",
    "sensors",
    "roomPowerWatts",
    "totalOfficePowerWatts",
    "alerts",
    "afterHours",
    "lastChanged",
    "onSince",
    "duration",
    "kWh",
    "cost"
  ];

  for (const field of forbiddenRootFields) {
    assert.equal(field in payload, false, `${field} must not be in telemetry payload`);
  }
});

test("telemetry devices include hardware-like measurements only", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T15:38:00.000Z"));
  store.setDeviceStatus("work1-fan-1", "on", new Date("2026-07-03T15:39:00.000Z"));
  store.setDeviceStatus("work1-light-1", "on", new Date("2026-07-03T15:39:00.000Z"));

  const payload = store.buildTelemetryPayload("work1", 1, "heartbeat", []);
  const fan = payload.devices.find((device) => device.id === "work1-fan-1");
  const light = payload.devices.find((device) => device.id === "work1-light-1");
  const offLight = payload.devices.find((device) => device.id === "work1-light-2");

  assert.ok(fan);
  assert.deepEqual(Object.keys(fan).sort(), ["id", "measurements", "status"]);
  assert.equal(fan.status, "on");
  assert.deepEqual(fan.measurements, {
    voltageVolts: 220,
    currentAmps: 0.273,
    powerWatts: 60
  });

  assert.ok(light);
  assert.deepEqual(light.measurements, {
    voltageVolts: 220,
    currentAmps: 0.068,
    powerWatts: 15
  });

  assert.ok(offLight);
  assert.deepEqual(offLight.measurements, {
    voltageVolts: 0,
    currentAmps: 0,
    powerWatts: 0
  });

  for (const device of payload.devices) {
    assert.equal("name" in device, false);
    assert.equal("type" in device, false);
    assert.equal("ratedPowerWatts" in device, false);
    assert.equal("currentPowerWatts" in device, false);
    assert.equal("powerMode" in device, false);
    assert.equal("measurementProfile" in device, false);
    assert.equal("customPowerWatts" in device, false);
    assert.equal("lastChanged" in device, false);
    assert.equal("onSince" in device, false);
  }
});

test("next telemetry payload increments per room and keeps full node snapshots", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));

  assert.equal(store.nextTelemetryPayload("drawing", "heartbeat", []).sequence, 1);
  assert.equal(store.nextTelemetryPayload("drawing", "heartbeat", []).sequence, 2);
  assert.equal(store.nextTelemetryPayload("work1", "boot", []).sequence, 1);

  for (const room of ROOM_DEFINITIONS) {
    const payload = store.nextTelemetryPayload(room.roomId, "manual_sync", []);
    assert.equal(payload.devices.length, 5);
  }
});

test("manual state changes and send-now actions update latest node payloads", async () => {
  const config = loadConfig(["--dry-run", "--no-auto-start"], {}, process.cwd());
  const logger = new Logger("error");
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));
  const client = new TelemetryClient(config, logger);
  const engine = new SimulationEngine(config, store, client, logger);

  store.setDeviceStatus("work1-fan-1", "on");
  const manualResult = await engine.sendRoomTelemetry("work1", "state_change", ["work1-fan-1"]);
  assert.equal(manualResult.ok, true);

  const manualPayload = engine.getTelemetryStatus().latestPayloadByRoom.work1;
  assert.ok(manualPayload);
  assert.equal(manualPayload.eventType, "state_change");
  assert.deepEqual(manualPayload.changedDeviceIds, ["work1-fan-1"]);
  assert.equal(manualPayload.devices.length, 5);

  const nodeResult = await engine.sendRoomTelemetry("drawing", "manual_sync");
  assert.equal(nodeResult.ok, true);
  assert.equal(engine.getTelemetryStatus().latestPayloadByRoom.drawing?.eventType, "manual_sync");

  const allResults = await engine.sendTelemetryNow();
  assert.equal(allResults.length, 3);
  assert.equal(allResults.every((result) => result.ok), true);
  assert.equal(engine.getTelemetryStatus().latestPayloads.length, 3);
});

test("heartbeat sends full payloads and dry-run succeeds without a backend", async () => {
  const config = loadConfig(["--dry-run", "--no-auto-start"], {}, process.cwd());
  const logger = new Logger("error");
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));
  const payload = store.buildTelemetryPayload("drawing", 1, "manual_sync", []);
  const client = new TelemetryClient(config, logger);

  const result = await client.sendPayload(payload, "drawing");
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.nodeId, "room-node-drawing");
  assert.equal(result.roomId, "drawing");
  assert.equal(result.sequence, 1);

  const engine = new SimulationEngine(config, store, client, logger);
  const heartbeatResults = await engine.sendAllTelemetry("heartbeat");
  assert.equal(heartbeatResults.length, 3);

  const status = engine.getTelemetryStatus();
  for (const payload of status.latestPayloads) {
    assert.equal(payload.eventType, "heartbeat");
    assert.equal(payload.changedDeviceIds.length, 0);
    assert.equal(payload.devices.length, 5);
  }
});
