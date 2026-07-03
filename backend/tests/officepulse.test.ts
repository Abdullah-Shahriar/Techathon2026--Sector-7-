import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/officepulse_test";
process.env.PORT = "4000";
process.env.DEVICE_API_KEY = "test-device-key";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.DEFAULT_TIMEZONE = "Asia/Dhaka";
process.env.DEFAULT_BDT_PER_KWH = "12";
process.env.DEFAULT_OFFICE_START_TIME = "09:00";
process.env.DEFAULT_OFFICE_END_TIME = "18:00";
process.env.DEFAULT_ALERT_REPEAT_MINUTES = "120";
process.env.HEARTBEAT_TIMEOUT_SECONDS = "20";
process.env.NODE_ENV = "test";

const { connectMongo, disconnectMongo } = await import("../src/db/mongoose.js");
const {
  Alert,
  AlertSetting,
  Device,
  Esp32Node,
  LatestDeviceState,
  NodeDiscoveryEvent,
  NodeSequenceLog,
  Room,
  Settings,
  UsageInterval
} = await import("../src/models/index.js");
const { ingestTelemetry } = await import("../src/telemetry/telemetry.service.js");
const { telemetryPayloadSchema } = await import("../src/telemetry/telemetry.schema.js");
const {
  getDeviceUsage,
  getRoomUsage,
  getTimeline,
  getUsageSummary,
  recordUsageIntervalFromPreviousState,
  splitUsageInterval
} = await import("../src/usage/usage.service.js");
const { evaluateAggregateAlerts, getEffectiveAlertSetting } = await import("../src/alerts/alert.service.js");
const { getSettings } = await import("../src/settings/settings.service.js");
const { zonedDateTimeToUtc } = await import("../src/utils/time.js");

await connectMongo();

test.beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

test.after(async () => {
  await mongoose.connection.db?.dropDatabase();
  await disconnectMongo();
});

test("telemetry ingest discovers ESP32 nodes, devices, and missed sequences", async () => {
  const first = await ingestTelemetry(telemetryPayload("room-node-lab", 1, "boot", "lab-fan-1", "on", 60), "test-device-key");

  assert.equal(first.accepted, true);
  assert.equal(first.nodeStatus, "pending");
  assert.equal(first.sequenceStatus, "ok");
  assert.equal(first.discoveredDevices, 1);
  assert.equal(first.updatedDevices, 1);

  const node = await Esp32Node.findOne({ nodeId: "room-node-lab" }).lean();
  assert.ok(node);
  assert.equal(node.status, "pending");
  assert.equal(node.roomId, null);

  const device = await Device.findOne({ nodeId: "room-node-lab", externalDeviceId: "lab-fan-1" }).lean();
  assert.ok(device);
  assert.equal(device.type, "fan");
  assert.equal(device.expectedPowerWatts, 60);

  const latest = await LatestDeviceState.findOne({ deviceId: device._id }).lean();
  assert.ok(latest);
  assert.equal(latest.status, "on");
  assert.equal(latest.powerWatts, 60);

  assert.ok(await NodeDiscoveryEvent.findOne({ nodeId: "room-node-lab", eventType: "unknown_node" }).lean());
  assert.ok(await NodeDiscoveryEvent.findOne({ nodeId: "room-node-lab", externalDeviceId: "lab-fan-1", eventType: "new_device" }).lean());
  assert.ok(await Alert.findOne({ alertType: "unknown_esp32_discovered", nodeId: "room-node-lab", status: "active" }).lean());
  assert.ok(await Alert.findOne({ alertType: "new_device_discovered", nodeId: "room-node-lab", status: "active" }).lean());

  const second = await ingestTelemetry(telemetryPayload("room-node-lab", 3, "heartbeat", "lab-fan-1", "on", 60), "test-device-key");
  assert.equal(second.sequenceStatus, "missed");
  assert.ok(await NodeSequenceLog.findOne({ nodeId: "room-node-lab", sequence: 3, status: "missed" }).lean());
  assert.ok(await Alert.findOne({ alertType: "missed_telemetry_sequence", nodeId: "room-node-lab", status: "active" }).lean());
});

test("usage intervals split at office boundaries and calculate kWh and BDT", async () => {
  const settings = {
    timezone: "Asia/Dhaka",
    officeStartTime: "09:00",
    officeEndTime: "18:00"
  };
  const startAt = zonedDateTimeToUtc(2026, 7, 3, 17, 0, 0, settings.timezone);
  const endAt = zonedDateTimeToUtc(2026, 7, 3, 19, 0, 0, settings.timezone);
  const segments = splitUsageInterval({
    deviceId: "device-1",
    roomId: "room-1",
    startAt,
    endAt,
    powerWatts: 60,
    voltageVolts: 220,
    currentAmps: 0.273,
    bdtPerUnitKwh: 12,
    settings
  });

  assert.equal(segments.length, 2);
  assert.equal(segments[0].durationSeconds, 3600);
  assert.equal(segments[0].isOfficeTime, true);
  assert.equal(segments[0].isOffTime, false);
  assert.equal(segments[0].unitKwh, 0.06);
  assert.equal(segments[0].costBdt, 0.72);
  assert.equal(segments[1].durationSeconds, 3600);
  assert.equal(segments[1].isOfficeTime, false);
  assert.equal(segments[1].isOffTime, true);
  assert.equal(segments[1].unitKwh, 0.06);
  assert.equal(segments[1].costBdt, 0.72);

  const room = await Room.create({ name: "Lab" });
  const device = await Device.create({
    nodeId: "room-node-lab",
    externalDeviceId: "lab-fan-1",
    roomId: room._id,
    name: "Fan 1",
    type: "fan",
    expectedPowerWatts: 60
  });
  const previous = await LatestDeviceState.create({
    deviceId: device._id,
    status: "on",
    voltageVolts: 220,
    currentAmps: 0.273,
    powerWatts: 60,
    lastChangedAt: startAt,
    onSince: startAt,
    lastTelemetryAt: startAt
  });

  await recordUsageIntervalFromPreviousState(previous, room._id, endAt, await getSettings());
  const stored = await UsageInterval.find({ deviceId: device._id }).sort({ startAt: 1 }).lean();
  assert.equal(stored.length, 2);
  assert.equal(stored[0].isOfficeTime, true);
  assert.equal(stored[1].isOffTime, true);
});

test("custom usage APIs support summary, rooms, devices, and custom timeline grouping", async () => {
  const room = await Room.create({ name: "Work 1" });
  const device = await Device.create({
    nodeId: "room-node-work1",
    externalDeviceId: "work1-fan-1",
    roomId: room._id,
    name: "Fan 1",
    type: "fan",
    expectedPowerWatts: 60
  });
  const startAt = new Date("2026-07-03T03:00:00.000Z");
  const middleAt = new Date("2026-07-03T04:00:00.000Z");
  const endAt = new Date("2026-07-03T05:00:00.000Z");

  await UsageInterval.insertMany([
    {
      deviceId: device._id,
      roomId: room._id,
      startAt,
      endAt: middleAt,
      durationSeconds: 3600,
      averagePowerWatts: 60,
      averageVoltageVolts: 220,
      averageCurrentAmps: 0.273,
      unitKwh: 0.06,
      costBdt: 0.72,
      isOfficeTime: true,
      isOffTime: false
    },
    {
      deviceId: device._id,
      roomId: room._id,
      startAt: middleAt,
      endAt,
      durationSeconds: 3600,
      averagePowerWatts: 120,
      averageVoltageVolts: 220,
      averageCurrentAmps: 0.545,
      unitKwh: 0.12,
      costBdt: 1.44,
      isOfficeTime: false,
      isOffTime: true
    }
  ]);

  const query = {
    range: "custom",
    start: startAt.toISOString(),
    end: endAt.toISOString(),
    roomId: String(room._id),
    deviceId: String(device._id)
  };
  const summary = await getUsageSummary(query, endAt);
  const rooms = await getRoomUsage(query, endAt);
  const devices = await getDeviceUsage(query, endAt);
  const timeline = await getTimeline({ ...query, groupBy: "custom", intervalSeconds: "3600" });

  assert.equal(summary.range, "custom");
  assert.equal(summary.totals.unitKwh, 0.18);
  assert.equal(summary.totals.costBdt, 2.16);
  assert.equal(summary.totals.officeTimeUnitKwh, 0.06);
  assert.equal(summary.totals.offTimeUnitKwh, 0.12);
  assert.equal(rooms.rooms.length, 1);
  assert.equal(rooms.rooms[0].roomId, String(room._id));
  assert.equal(devices.devices.length, 1);
  assert.equal(devices.devices[0].deviceId, String(device._id));
  assert.equal(timeline.groupBy, "custom");
  assert.equal(timeline.intervalSeconds, 3600);
  assert.equal(timeline.buckets.length, 2);
  assert.deepEqual(timeline.buckets.map((bucket) => bucket.unitKwh), [0.06, 0.12]);
});

test("alert settings resolve with device over room over global priority", async () => {
  const room = await Room.create({ name: "Priority Room" });
  const device = await Device.create({
    nodeId: "room-node-priority",
    externalDeviceId: "priority-fan-1",
    roomId: room._id,
    name: "Fan 1",
    type: "fan",
    expectedPowerWatts: 60
  });

  await AlertSetting.create({
    scope: "global",
    roomId: null,
    deviceId: null,
    alertType: "abnormal_high_power",
    enabled: true,
    severity: "warning",
    thresholdJson: { multiplier: 1.5 },
    repeatEveryMinutes: 120
  });
  const roomSetting = await AlertSetting.create({
    scope: "room",
    roomId: room._id,
    deviceId: null,
    alertType: "abnormal_high_power",
    enabled: true,
    severity: "critical",
    thresholdJson: { multiplier: 1.3 },
    repeatEveryMinutes: 60
  });
  const deviceSetting = await AlertSetting.create({
    scope: "device",
    roomId: null,
    deviceId: device._id,
    alertType: "abnormal_high_power",
    enabled: false,
    severity: "info",
    thresholdJson: { multiplier: 1.1 },
    repeatEveryMinutes: 10
  });

  assert.equal(String((await getEffectiveAlertSetting("abnormal_high_power", room._id, device._id))?._id), String(deviceSetting._id));
  await AlertSetting.deleteOne({ _id: deviceSetting._id });
  assert.equal(String((await getEffectiveAlertSetting("abnormal_high_power", room._id, device._id))?._id), String(roomSetting._id));
  await AlertSetting.deleteOne({ _id: roomSetting._id });
  assert.equal((await getEffectiveAlertSetting("abnormal_high_power", room._id, device._id))?.scope, "global");
});

test("off-time active device alerts create visible repeat occurrences", async () => {
  await Settings.findOneAndUpdate(
    { key: "default" },
    {
      $set: {
        key: "default",
        officeStartTime: "09:00",
        officeEndTime: "18:00",
        timezone: "Asia/Dhaka",
        bdtPerUnitKwh: 12,
        defaultAlertRepeatMinutes: 1,
        heartbeatTimeoutSeconds: 20
      }
    },
    { upsert: true }
  );
  await AlertSetting.findOneAndUpdate(
    { scope: "global", roomId: null, deviceId: null, alertType: "off_time_device_on" },
    {
      $set: {
        enabled: true,
        severity: "warning",
        repeatEveryMinutes: 1,
        thresholdJson: null
      }
    },
    { upsert: true }
  );

  const room = await Room.create({ name: "Repeat Room" });
  const device = await Device.create({
    nodeId: "room-node-repeat",
    externalDeviceId: "repeat-fan-1",
    roomId: room._id,
    name: "Fan 1",
    type: "fan",
    expectedPowerWatts: 60
  });
  await LatestDeviceState.create({
    deviceId: device._id,
    status: "on",
    voltageVolts: 220,
    currentAmps: 0.273,
    powerWatts: 60,
    lastChangedAt: new Date("2026-07-03T13:00:00.000Z"),
    onSince: new Date("2026-07-03T13:00:00.000Z"),
    lastTelemetryAt: new Date("2026-07-03T13:00:00.000Z")
  });

  await evaluateAggregateAlerts(zonedDateTimeToUtc(2026, 7, 3, 20, 0, 0, "Asia/Dhaka"));
  await evaluateAggregateAlerts(zonedDateTimeToUtc(2026, 7, 3, 20, 0, 30, "Asia/Dhaka"));
  await evaluateAggregateAlerts(zonedDateTimeToUtc(2026, 7, 3, 20, 2, 0, "Asia/Dhaka"));

  const alert = await Alert.findOne({ alertType: "off_time_device_on", deviceId: device._id, status: "active" }).lean();
  assert.ok(alert);
  assert.equal(alert.occurrences.length, 2);
  assert.deepEqual(alert.occurrences.map((occurrence: { repeatNumber: number }) => occurrence.repeatNumber), [1, 2]);
});

test("telemetry schema accepts only the final top-level and device payload contract", () => {
  const payload = telemetryPayload("room-node-contract", 1, "manual_sync", "contract-fan-1", "on", 60);
  assert.deepEqual(Object.keys(payload).sort(), [
    "changedDeviceIds",
    "devices",
    "eventType",
    "nodeId",
    "schemaVersion",
    "sequence"
  ]);
  assert.equal(telemetryPayloadSchema.safeParse(payload).success, true);

  const forbiddenUptimeField = ["device", "Uptime", "Ms"].join("");
  const withDeviceUptime = { ...payload, [forbiddenUptimeField]: 1000 };
  assert.equal(telemetryPayloadSchema.safeParse(withDeviceUptime).success, false);

  const withRatedPower = {
    ...payload,
    devices: [{ ...payload.devices[0], ratedPowerWatts: 60 }]
  };
  assert.equal(telemetryPayloadSchema.safeParse(withRatedPower).success, false);
});

function telemetryPayload(
  nodeId: string,
  sequence: number,
  eventType: "boot" | "heartbeat" | "state_change" | "manual_sync",
  deviceId: string,
  status: "on" | "off",
  powerWatts: number
) {
  return {
    schemaVersion: "1.0" as const,
    nodeId,
    sequence,
    eventType,
    changedDeviceIds: [deviceId],
    devices: [{
      id: deviceId,
      status,
      measurements: {
        voltageVolts: status === "on" ? 220 : 0,
        currentAmps: status === "on" ? Number((powerWatts / 220).toFixed(3)) : 0,
        powerWatts: status === "on" ? powerWatts : 0
      }
    }]
  };
}
