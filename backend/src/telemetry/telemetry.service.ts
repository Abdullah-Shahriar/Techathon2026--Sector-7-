import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { Device, Esp32Node, LatestDeviceState, NodeDiscoveryEvent, NodeSequenceLog, TelemetryEvent } from "../models/index.js";
import { getAlertThresholdNumber, scheduleAggregateAlerts, upsertActiveAlert, resolveMatchingAlerts } from "../alerts/alert.service.js";
import { emitRealtime } from "../realtime/socket.js";
import { logger } from "../logger.js";
import { getSettings } from "../settings/settings.service.js";
import type { SequenceStatus } from "../types/domain.js";
import { inferDeviceType, inferExpectedPowerWatts, isOfficeTime, titleFromDeviceId } from "../utils/time.js";
import { recordUsageIntervalFromPreviousState } from "../usage/usage.service.js";
import type { TelemetryPayload } from "./telemetry.schema.js";

interface DeviceAlertInput {
  nodeId: string;
  deviceId: unknown;
  roomId: unknown;
  externalDeviceId: string;
  status: "on" | "off";
  powerWatts: number;
  expectedPowerWatts: number | null | undefined;
  receivedAt: Date;
}

const pendingDeviceAlertEvaluations = new Map<string, DeviceAlertInput>();
let deviceAlertEvaluationTimer: NodeJS.Timeout | null = null;
let deviceAlertEvaluationInFlight = false;

export async function storeInvalidTelemetry(payload: unknown, error: string): Promise<void> {
  const maybePayload = payload as Partial<TelemetryPayload> | null;
  await TelemetryEvent.create({
    nodeId: typeof maybePayload?.nodeId === "string" ? maybePayload.nodeId : "unknown",
    sequence: typeof maybePayload?.sequence === "number" ? maybePayload.sequence : null,
    eventType: typeof maybePayload?.eventType === "string" ? maybePayload.eventType : null,
    receivedAt: new Date(),
    payloadJson: payload,
    isValid: false,
    error
  });
}

export async function ingestTelemetry(payload: TelemetryPayload, apiKey: string): Promise<{
  accepted: true;
  nodeId: string;
  nodeStatus: string;
  sequenceStatus: SequenceStatus;
  ignoredReason?: string;
  discoveredDevices: number;
  updatedDevices: number;
}> {
  const receivedAt = new Date();
  const settings = await getSettings();

  await TelemetryEvent.create({
    nodeId: payload.nodeId,
    sequence: payload.sequence,
    eventType: payload.eventType,
    receivedAt,
    payloadJson: payload,
    isValid: true,
    error: null
  });

  const { node, isNewNode } = await upsertNode(payload, apiKey, receivedAt);
  const previousSequence = node.lastSequence;
  const sequenceStatus = await recordSequence(node.nodeId, previousSequence, payload.sequence, receivedAt);
  const previousStatus = node.status;

  if (sequenceStatus === "duplicate") {
    return {
      accepted: true,
      nodeId: payload.nodeId,
      nodeStatus: node.status,
      sequenceStatus,
      ignoredReason: `Telemetry sequence ${payload.sequence} was ignored because the latest accepted sequence is ${previousSequence}.`,
      discoveredDevices: 0,
      updatedDevices: 0
    };
  }

  node.lastSeenAt = receivedAt;
  node.lastSequence = payload.sequence;
  if (payload.eventType === "heartbeat" || payload.eventType === "boot") {
    node.lastHeartbeatAt = receivedAt;
  }
  if (node.status === "offline") {
    node.status = node.roomId ? "active" : "pending";
    runTelemetrySideEffect("resolve node back online alerts", async () => {
      await resolveMatchingAlerts({ alertType: "esp32_offline", nodeId: node.nodeId, now: receivedAt });
      await resolveMatchingAlerts({ alertType: "missing_heartbeat", nodeId: node.nodeId, now: receivedAt });
      await upsertActiveAlert({
        alertType: "esp32_back_online",
        scope: "node",
        roomId: node.roomId,
        nodeId: node.nodeId,
        title: "ESP32 node back online",
        message: `${node.nodeId} resumed telemetry.`,
        severity: "info",
        now: receivedAt
      });
    });
    emitRealtime("node_online", { nodeId: node.nodeId });
  }
  await node.save();

  if (isNewNode) {
    emitRealtime("node_discovered", { nodeId: node.nodeId });
  }

  if (sequenceStatus === "missed") {
    runTelemetrySideEffect("create missed sequence alert", () => upsertActiveAlert({
      alertType: "missed_telemetry_sequence",
      scope: "node",
      roomId: node.roomId,
      nodeId: node.nodeId,
      title: "Missed telemetry sequence",
      message: `${node.nodeId} skipped from sequence ${previousSequence ?? "none"} to ${payload.sequence}.`,
      severity: "warning",
      dataJson: { sequence: payload.sequence },
      now: receivedAt
    }));
  }

  let discoveredDevices = 0;
  let updatedDevices = 0;

  if (node.status !== "ignored") {
    for (const incoming of payload.devices) {
      const { discovered } = await upsertDeviceFromTelemetry(payload.nodeId, node.roomId, incoming.id, receivedAt);
      const device = await Device.findOne({ nodeId: payload.nodeId, externalDeviceId: incoming.id });
      if (!device) {
        continue;
      }

      if (discovered) {
        discoveredDevices += 1;
      }

      const previousState = await LatestDeviceState.findOne({ deviceId: device._id });
      await recordUsageIntervalFromPreviousState(previousState, device.roomId, receivedAt, settings);

      const statusChanged = !previousState || previousState.status !== incoming.status;
      await LatestDeviceState.findOneAndUpdate(
        { deviceId: device._id },
        {
          $set: {
            deviceId: device._id,
            status: incoming.status,
            voltageVolts: incoming.measurements.voltageVolts,
            currentAmps: incoming.measurements.currentAmps,
            powerWatts: incoming.measurements.powerWatts,
            lastChangedAt: statusChanged ? receivedAt : previousState?.lastChangedAt ?? receivedAt,
            onSince: incoming.status === "on"
              ? previousState?.status === "on" ? previousState.onSince : receivedAt
              : null,
            lastTelemetryAt: receivedAt
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      queueDeviceAlertEvaluation({
        nodeId: payload.nodeId,
        deviceId: device._id,
        roomId: device.roomId,
        externalDeviceId: incoming.id,
        status: incoming.status,
        powerWatts: incoming.measurements.powerWatts,
        expectedPowerWatts: device.expectedPowerWatts,
        receivedAt
      });
      updatedDevices += 1;
      emitRealtime("device_state_changed", { deviceId: String(device._id), externalDeviceId: incoming.id });
    }
  }

  if (previousStatus !== node.status) {
    emitRealtime("office_state_updated", { reason: "node_status", nodeId: node.nodeId });
  }

  emitRealtime("usage_updated", { nodeId: payload.nodeId });
  scheduleAggregateAlerts(receivedAt);
  emitRealtime("office_state_updated", { reason: "telemetry", nodeId: payload.nodeId });

  return {
    accepted: true,
    nodeId: payload.nodeId,
    nodeStatus: node.status,
    sequenceStatus,
    discoveredDevices,
    updatedDevices
  };
}

async function upsertNode(payload: TelemetryPayload, apiKey: string, receivedAt: Date) {
  let node = await Esp32Node.findOne({ nodeId: payload.nodeId });
  if (node) {
    return { node, isNewNode: false };
  }

  node = await Esp32Node.create({
    nodeId: payload.nodeId,
    roomId: null,
    status: "pending",
    lastSeenAt: receivedAt,
    lastSequence: null,
    lastHeartbeatAt: payload.eventType === "heartbeat" || payload.eventType === "boot" ? receivedAt : null,
    apiKeyHash: hashApiKey(apiKey)
  });

  await NodeDiscoveryEvent.findOneAndUpdate(
    { nodeId: payload.nodeId, externalDeviceId: null, eventType: "unknown_node" },
    {
      $setOnInsert: {
        nodeId: payload.nodeId,
        externalDeviceId: null,
        eventType: "unknown_node",
        status: "pending",
        firstSeenAt: receivedAt,
        dataJson: { firstSequence: payload.sequence }
      },
      $set: { lastSeenAt: receivedAt }
    },
    { upsert: true, new: true }
  );

  await upsertActiveAlert({
    alertType: "unknown_esp32_discovered",
    scope: "node",
    nodeId: payload.nodeId,
    title: "Unknown ESP32 node discovered",
    message: `${payload.nodeId} sent telemetry and is waiting for room assignment.`,
    severity: "info",
    dataJson: { sequence: payload.sequence },
    now: receivedAt
  });

  return { node, isNewNode: true };
}

async function recordSequence(
  nodeId: string,
  lastSequence: number | null | undefined,
  sequence: number,
  receivedAt: Date
): Promise<SequenceStatus> {
  let status: SequenceStatus = "ok";
  if (lastSequence !== null && lastSequence !== undefined) {
    if (sequence <= lastSequence) {
      status = "duplicate";
    } else if (sequence > lastSequence + 1) {
      status = "missed";
    }
  }

  await NodeSequenceLog.create({ nodeId, sequence, receivedAt, status });
  return status;
}

async function upsertDeviceFromTelemetry(
  nodeId: string,
  roomId: unknown,
  externalDeviceId: string,
  receivedAt: Date
): Promise<{ discovered: boolean }> {
  const type = inferDeviceType(externalDeviceId);
  const expectedPowerWatts = inferExpectedPowerWatts(type);
  const existing = await Device.findOne({ nodeId, externalDeviceId });
  if (existing) {
    const updates: Record<string, unknown> = { isActive: true };
    if (roomId && String(existing.roomId ?? "") !== String(roomId)) {
      updates.roomId = roomId;
    }
    if (!existing.expectedPowerWatts && expectedPowerWatts) {
      updates.expectedPowerWatts = expectedPowerWatts;
    }
    await existing.updateOne({ $set: updates });
    return { discovered: false };
  }

  await Device.create({
    nodeId,
    externalDeviceId,
    roomId: roomId ?? null,
    name: titleFromDeviceId(externalDeviceId),
    type,
    expectedPowerWatts,
    isActive: true
  });

  await NodeDiscoveryEvent.findOneAndUpdate(
    { nodeId, externalDeviceId, eventType: "new_device" },
    {
      $setOnInsert: {
        nodeId,
        externalDeviceId,
        eventType: "new_device",
        status: "pending",
        firstSeenAt: receivedAt,
        dataJson: { type, expectedPowerWatts }
      },
      $set: { lastSeenAt: receivedAt }
    },
    { upsert: true, new: true }
  );

  await upsertActiveAlert({
    alertType: "new_device_discovered",
    scope: "node",
    roomId,
    nodeId,
    title: "New device discovered",
    message: `${externalDeviceId} appeared on ${nodeId}.`,
    severity: "info",
    dataJson: { externalDeviceId, type },
    now: receivedAt
  });

  return { discovered: true };
}

function queueDeviceAlertEvaluation(input: DeviceAlertInput): void {
  pendingDeviceAlertEvaluations.set(String(input.deviceId), input);
  scheduleDeviceAlertFlush();
}

function scheduleDeviceAlertFlush(): void {
  if (deviceAlertEvaluationTimer || deviceAlertEvaluationInFlight) {
    return;
  }

  deviceAlertEvaluationTimer = setTimeout(() => {
    deviceAlertEvaluationTimer = null;
    void flushDeviceAlertEvaluations();
  }, 250);
  deviceAlertEvaluationTimer.unref?.();
}

async function flushDeviceAlertEvaluations(): Promise<void> {
  if (deviceAlertEvaluationInFlight) {
    scheduleDeviceAlertFlush();
    return;
  }

  deviceAlertEvaluationInFlight = true;
  const evaluations = [...pendingDeviceAlertEvaluations.values()];
  pendingDeviceAlertEvaluations.clear();

  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    for (const input of evaluations) {
      await evaluateDeviceAlerts(input);
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Queued telemetry alert evaluation failed");
  } finally {
    deviceAlertEvaluationInFlight = false;
    if (pendingDeviceAlertEvaluations.size > 0) {
      scheduleDeviceAlertFlush();
    }
  }
}

function runTelemetrySideEffect(label: string, task: () => Promise<unknown>): void {
  void task().catch((error) => {
    logger.error({ label, error: error instanceof Error ? error.message : String(error) }, "Telemetry side effect failed");
  });
}

async function evaluateDeviceAlerts(input: DeviceAlertInput): Promise<void> {
  const settings = await getSettings();

  if (input.status === "on" && !isOfficeTime(input.receivedAt, settings as any)) {
    await upsertActiveAlert({
      alertType: "off_time_device_on",
      scope: "device",
      roomId: input.roomId,
      deviceId: input.deviceId,
      nodeId: input.nodeId,
      title: "Device on outside office time",
      message: `${input.externalDeviceId} is on outside configured office hours.`,
      severity: "warning",
      dataJson: { externalDeviceId: input.externalDeviceId, powerWatts: input.powerWatts },
      now: input.receivedAt
    });
  } else {
    await resolveMatchingAlerts({ alertType: "off_time_device_on", deviceId: input.deviceId, now: input.receivedAt });
  }

  if (input.status === "on" && input.powerWatts === 0) {
    await upsertActiveAlert({
      alertType: "device_on_power_zero",
      scope: "device",
      roomId: input.roomId,
      deviceId: input.deviceId,
      nodeId: input.nodeId,
      title: "Device is on but power is zero",
      message: `${input.externalDeviceId} reports ON with 0W.`,
      severity: "warning",
      now: input.receivedAt
    });
  } else {
    await resolveMatchingAlerts({ alertType: "device_on_power_zero", deviceId: input.deviceId, now: input.receivedAt });
  }

  if (input.status === "off" && input.powerWatts > 1) {
    await upsertActiveAlert({
      alertType: "device_off_power_flowing",
      scope: "device",
      roomId: input.roomId,
      deviceId: input.deviceId,
      nodeId: input.nodeId,
      title: "Device is off but power is flowing",
      message: `${input.externalDeviceId} reports OFF while drawing ${input.powerWatts}W.`,
      severity: "critical",
      now: input.receivedAt
    });
  } else {
    await resolveMatchingAlerts({ alertType: "device_off_power_flowing", deviceId: input.deviceId, now: input.receivedAt });
  }

  const highPowerMultiplier = await getAlertThresholdNumber(
    "abnormal_high_power",
    "multiplier",
    1.5,
    input.roomId,
    input.deviceId
  );
  if (input.expectedPowerWatts && input.powerWatts > input.expectedPowerWatts * highPowerMultiplier) {
    await upsertActiveAlert({
      alertType: "abnormal_high_power",
      scope: "device",
      roomId: input.roomId,
      deviceId: input.deviceId,
      nodeId: input.nodeId,
      title: "Abnormally high power",
      message: `${input.externalDeviceId} is drawing ${input.powerWatts}W against expected ${input.expectedPowerWatts}W.`,
      severity: "warning",
      dataJson: {
        expectedPowerWatts: input.expectedPowerWatts,
        powerWatts: input.powerWatts,
        multiplier: highPowerMultiplier
      },
      now: input.receivedAt
    });
  } else {
    await resolveMatchingAlerts({ alertType: "abnormal_high_power", deviceId: input.deviceId, now: input.receivedAt });
  }
}

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}
