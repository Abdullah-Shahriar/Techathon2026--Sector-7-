import { z } from "zod";
import { recordAuditLog } from "../audit/audit.service.js";
import { logger } from "../logger.js";
import { Alert, AlertOccurrence, AlertSetting, Device, Esp32Node, LatestDeviceState, Room, type AlertDocument } from "../models/index.js";
import { emitRealtime } from "../realtime/socket.js";
import { getSettings } from "../settings/settings.service.js";
import type { AlertScope, AlertSeverity } from "../types/domain.js";
import { estimatedMonthlyBill, summarizeRange } from "../usage/usage.service.js";
import { isOfficeTime, startOfZonedDay } from "../utils/time.js";

export const updateAlertSettingsSchema = z.object({
  settings: z.array(z.object({
    id: z.string().optional(),
    scope: z.enum(["global", "room", "device"]),
    roomId: z.string().nullable().optional(),
    deviceId: z.string().nullable().optional(),
    alertType: z.string().min(1),
    enabled: z.boolean().optional(),
    severity: z.enum(["info", "warning", "critical"]).optional(),
    thresholdJson: z.unknown().optional(),
    repeatEveryMinutes: z.number().int().positive().nullable().optional()
  })).min(1)
});

interface UpsertAlertInput {
  alertType: string;
  scope: AlertScope;
  title: string;
  message: string;
  severity?: AlertSeverity;
  roomId?: unknown;
  deviceId?: unknown;
  nodeId?: string | null;
  dataJson?: Record<string, unknown>;
  now?: Date;
}

const alertScopeSupport = {
  off_time_device_on: ["global", "room", "device"],
  esp32_offline: ["global", "room"],
  missing_heartbeat: ["global", "room"],
  esp32_back_online: ["global", "room"],
  unknown_esp32_discovered: ["global", "room"],
  new_device_discovered: ["global", "room", "device"],
  missed_telemetry_sequence: ["global", "room"],
  device_on_power_zero: ["global", "room", "device"],
  device_off_power_flowing: ["global", "room", "device"],
  abnormal_high_power: ["global", "room", "device"],
  high_room_usage: ["global", "room"],
  high_office_usage: ["global"],
  high_off_time_cost: ["global", "room"],
  high_monthly_estimate: ["global"]
} as const satisfies Record<string, readonly ["global", ...Array<"room" | "device">]>;

export function listAlertTypeMetadata(): Array<{
  alertType: string;
  supportedScopes: string[];
}> {
  return Object.entries(alertScopeSupport).map(([alertType, supportedScopes]) => ({
    alertType,
    supportedScopes: [...supportedScopes]
  }));
}

let aggregateEvaluationInFlight = false;
let lastAggregateEvaluationStartedAt = 0;

export async function listAlerts(status?: string): Promise<AlertDocument[]> {
  const filter = status ? { status } : {};
  return Alert.find(filter).sort({ createdAt: -1 }).limit(200);
}

export async function listAlertSettings(): Promise<unknown[]> {
  return AlertSetting.find({}).sort({ scope: 1, alertType: 1, createdAt: 1 });
}

export async function listAlertOccurrences(alertId: string): Promise<unknown[]> {
  return AlertOccurrence.find({ alertId }).sort({ occurredAt: -1 }).limit(500).lean();
}

export async function updateAlertSettings(input: z.infer<typeof updateAlertSettingsSchema>): Promise<unknown[]> {
  const parsed = updateAlertSettingsSchema.parse(input);
  const updated = [];

  for (const setting of parsed.settings) {
    assertSupportedAlertScope(setting.alertType, setting.scope);
    if (setting.scope === "room" && !setting.roomId) {
      throw new Error("Room-scoped alert settings require roomId");
    }
    if (setting.scope === "device" && !setting.deviceId) {
      throw new Error("Device-scoped alert settings require deviceId");
    }

    const filter = setting.id
      ? { _id: setting.id }
      : {
          scope: setting.scope,
          roomId: setting.scope === "room" ? setting.roomId ?? null : null,
          deviceId: setting.scope === "device" ? setting.deviceId ?? null : null,
          alertType: setting.alertType
        };

    const saved = await AlertSetting.findOneAndUpdate(
      filter,
      {
        $set: {
          scope: setting.scope,
          roomId: setting.scope === "room" ? setting.roomId ?? null : null,
          deviceId: setting.scope === "device" ? setting.deviceId ?? null : null,
          alertType: setting.alertType,
          ...(setting.enabled !== undefined ? { enabled: setting.enabled } : {}),
          ...(setting.severity ? { severity: setting.severity } : {}),
          ...(setting.thresholdJson !== undefined ? { thresholdJson: setting.thresholdJson } : {}),
          ...(setting.repeatEveryMinutes !== undefined ? { repeatEveryMinutes: setting.repeatEveryMinutes } : {})
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    updated.push(saved);
    await recordAuditLog({
      action: "alert_setting_changed",
      resourceType: "alert_setting",
      resourceId: saved?._id,
      dataJson: {
        alertType: setting.alertType,
        scope: setting.scope,
        roomId: setting.scope === "room" ? setting.roomId ?? null : null,
        deviceId: setting.scope === "device" ? setting.deviceId ?? null : null
      }
    });
  }

  emitRealtime("settings_updated", { kind: "alert_settings" });
  return updated;
}

export async function acknowledgeAlert(id: string): Promise<AlertDocument | null> {
  const alert = await Alert.findByIdAndUpdate(
    id,
    { $set: { status: "acknowledged", acknowledgedAt: new Date() } },
    { new: true }
  );
  if (alert) {
    await recordAuditLog({
      action: "alert_acknowledged",
      resourceType: "alert",
      resourceId: alert._id,
      dataJson: { alertType: alert.alertType }
    });
  }
  emitRealtime("alert_resolved", alert);
  return alert;
}

export async function resolveAlert(id: string): Promise<AlertDocument | null> {
  const alert = await Alert.findByIdAndUpdate(
    id,
    { $set: { status: "resolved", resolvedAt: new Date() } },
    { new: true }
  );
  if (alert) {
    await recordAuditLog({
      action: "alert_resolved",
      resourceType: "alert",
      resourceId: alert._id,
      dataJson: { alertType: alert.alertType }
    });
  }
  emitRealtime("alert_resolved", alert);
  return alert;
}

export async function upsertActiveAlert(input: UpsertAlertInput): Promise<AlertDocument | null> {
  const now = input.now ?? new Date();
  const setting = await getEffectiveAlertSetting(input.alertType, input.roomId, input.deviceId);
  if (setting && setting.enabled === false) {
    await resolveMatchingAlerts({
      alertType: input.alertType,
      roomId: input.roomId,
      deviceId: input.deviceId,
      nodeId: input.nodeId,
      now
    });
    return null;
  }

  const severity = (setting?.severity ?? input.severity ?? "warning") as AlertSeverity;
  const repeatEveryMinutes = setting?.repeatEveryMinutes ?? (await getSettings()).defaultAlertRepeatMinutes;
  const existing = await Alert.findOne({
    alertType: input.alertType,
    status: "active",
    scope: input.scope,
    roomId: input.roomId ?? null,
    deviceId: input.deviceId ?? null,
    nodeId: input.nodeId ?? null
  });

  if (existing) {
    const shouldRepeat = !existing.lastRepeatedAt ||
      now.getTime() - existing.lastRepeatedAt.getTime() >= repeatEveryMinutes * 60 * 1000;
    if (shouldRepeat) {
      const occurrences = Array.isArray(existing.occurrences) ? existing.occurrences : [];
      const occurrence = await AlertOccurrence.create({
        alertId: existing._id,
        alertType: input.alertType,
        occurredAt: now,
        message: input.message,
        dataJson: input.dataJson ?? {},
        notificationStatus: "pending",
        repeatNumber: occurrences.length + 1
      });
      existing.lastRepeatedAt = now;
      existing.message = input.message;
      existing.dataJson = input.dataJson ?? {};
      existing.occurrences = [
        ...occurrences,
        {
          occurredAt: now,
          message: input.message,
          dataJson: input.dataJson ?? {},
          occurrenceId: occurrence._id,
          repeatNumber: occurrences.length + 1
        }
      ];
      await existing.save();
      emitRealtime("alert_created", serializeRealtimeAlert(existing, occurrence));
    }
    return existing;
  }

  const alert = await Alert.create({
    alertType: input.alertType,
    scope: input.scope,
    roomId: input.roomId ?? null,
    deviceId: input.deviceId ?? null,
    nodeId: input.nodeId ?? null,
    severity,
    status: "active",
    title: input.title,
    message: input.message,
    dataJson: input.dataJson ?? {},
    occurrences: [],
    createdAt: now,
    lastRepeatedAt: now
  });

  const occurrence = await AlertOccurrence.create({
    alertId: alert._id,
    alertType: input.alertType,
    occurredAt: now,
    message: input.message,
    dataJson: input.dataJson ?? {},
    notificationStatus: "pending",
    repeatNumber: 1
  });
  alert.occurrences = [{
    occurredAt: now,
    message: input.message,
    dataJson: input.dataJson ?? {},
    occurrenceId: occurrence._id,
    repeatNumber: 1
  }];
  await alert.save();

  emitRealtime("alert_created", serializeRealtimeAlert(alert, occurrence));
  return alert;
}

export async function resolveMatchingAlerts(input: {
  alertType: string;
  roomId?: unknown;
  deviceId?: unknown;
  nodeId?: string | null;
  now?: Date;
}): Promise<void> {
  const filter: Record<string, unknown> = {
    alertType: input.alertType,
    status: "active"
  };
  const hasRoomId = Object.prototype.hasOwnProperty.call(input, "roomId");
  const hasDeviceId = Object.prototype.hasOwnProperty.call(input, "deviceId");
  const hasNodeId = Object.prototype.hasOwnProperty.call(input, "nodeId");

  if (hasDeviceId) {
    filter.deviceId = input.deviceId ?? null;
    if (hasRoomId) {
      filter.roomId = input.roomId ?? null;
    }
  } else if (hasNodeId) {
    filter.nodeId = input.nodeId ?? null;
    if (hasRoomId) {
      filter.roomId = input.roomId ?? null;
    }
  } else if (hasRoomId) {
    filter.roomId = input.roomId ?? null;
    filter.deviceId = null;
    filter.nodeId = null;
  } else {
    filter.roomId = null;
    filter.deviceId = null;
    filter.nodeId = null;
  }

  const result = await Alert.updateMany(
    filter,
    { $set: { status: "resolved", resolvedAt: input.now ?? new Date() } }
  );

  if (result.modifiedCount > 0) {
    emitRealtime("alert_resolved", {
      alertType: input.alertType,
      roomId: input.roomId ?? null,
      deviceId: input.deviceId ?? null,
      nodeId: input.nodeId ?? null
    });
  }
}

export async function resolveNewDeviceDiscoveryAlert(input: {
  nodeId: string;
  externalDeviceId: string;
  now?: Date;
}): Promise<void> {
  const result = await Alert.updateMany(
    {
      alertType: "new_device_discovered",
      status: "active",
      nodeId: input.nodeId,
      "dataJson.externalDeviceId": input.externalDeviceId
    },
    { $set: { status: "resolved", resolvedAt: input.now ?? new Date() } }
  );

  if (result.modifiedCount > 0) {
    emitRealtime("alert_resolved", {
      alertType: "new_device_discovered",
      nodeId: input.nodeId,
      externalDeviceId: input.externalDeviceId
    });
  }
}

export async function checkOfflineNodes(now = new Date()): Promise<void> {
  const settings = await getSettings();
  const cutoff = new Date(now.getTime() - settings.heartbeatTimeoutSeconds * 1000);
  const staleNodes = await Esp32Node.find({
    status: "active",
    lastSeenAt: { $lt: cutoff }
  });

  for (const node of staleNodes) {
    node.status = "offline";
    await node.save();
    await upsertActiveAlert({
      alertType: "esp32_offline",
      scope: "node",
      roomId: node.roomId,
      nodeId: node.nodeId,
      title: "ESP32 node offline",
      message: `${node.nodeId} has not sent telemetry within ${settings.heartbeatTimeoutSeconds} seconds.`,
      severity: "critical",
      now
    });
    await upsertActiveAlert({
      alertType: "missing_heartbeat",
      scope: "node",
      roomId: node.roomId,
      nodeId: node.nodeId,
      title: "Missing ESP32 heartbeat",
      message: `${node.nodeId} missed the configured heartbeat window.`,
      severity: "critical",
      now
    });
    emitRealtime("node_offline", { nodeId: node.nodeId });
  }
}

export function scheduleAggregateAlerts(now = new Date()): void {
  const currentTime = Date.now();
  if (aggregateEvaluationInFlight || currentTime - lastAggregateEvaluationStartedAt < 5_000) {
    return;
  }

  aggregateEvaluationInFlight = true;
  lastAggregateEvaluationStartedAt = currentTime;
  void evaluateAggregateAlerts(now)
    .catch((error) => logger.error({ error }, "Scheduled aggregate alert evaluation failed"))
    .finally(() => {
      aggregateEvaluationInFlight = false;
    });
}

export async function evaluateAggregateAlerts(now = new Date()): Promise<void> {
  const settings = await getSettings();
  const [rooms, devices, latestStates] = await Promise.all([
    Room.find({ isActive: true }).lean(),
    Device.find({ isActive: true }).lean(),
    LatestDeviceState.find({}).lean()
  ]);
  const latestByDeviceId = new Map(latestStates.map((state) => [String(state.deviceId), state]));
  const todayStart = startOfZonedDay(now, settings.timezone);
  const currentlyOfficeTime = isOfficeTime(now, settings as any);

  for (const device of devices) {
    const state = latestByDeviceId.get(String(device._id));
    if (state?.status === "on" && !currentlyOfficeTime) {
      await upsertActiveAlert({
        alertType: "off_time_device_on",
        scope: "device",
        roomId: device.roomId,
        deviceId: device._id,
        nodeId: device.nodeId,
        title: "Device on outside office time",
        message: `${device.externalDeviceId} is on outside configured office hours.`,
        severity: "warning",
        dataJson: {
          externalDeviceId: device.externalDeviceId,
          powerWatts: state.powerWatts
        },
        now
      });
    } else {
      await resolveMatchingAlerts({ alertType: "off_time_device_on", deviceId: device._id, now });
    }
  }

  let officePowerWatts = 0;
  for (const room of rooms) {
    const roomDevices = devices.filter((device) => String(device.roomId ?? "") === String(room._id));
    const currentPowerWatts = roomDevices.reduce((sum, device) => {
      const state = latestByDeviceId.get(String(device._id));
      return sum + (state?.powerWatts ?? 0);
    }, 0);
    officePowerWatts += currentPowerWatts;

    const roomPowerThreshold = await getAlertThresholdNumber("high_room_usage", "powerWatts", 150, room._id);
    if (currentPowerWatts > roomPowerThreshold) {
      await upsertActiveAlert({
        alertType: "high_room_usage",
        scope: "room",
        roomId: room._id,
        title: "High room usage",
        message: `${room.name} is drawing ${currentPowerWatts}W, above the ${roomPowerThreshold}W threshold.`,
        severity: "warning",
        dataJson: { currentPowerWatts, thresholdWatts: roomPowerThreshold },
        now
      });
    } else {
      await resolveMatchingAlerts({ alertType: "high_room_usage", roomId: room._id, now });
    }

    const roomUsage = await summarizeRange(todayStart, now, { roomId: String(room._id) });
    const roomOffTimeCostThreshold = await getAlertThresholdNumber("high_off_time_cost", "bdt", 100, room._id);
    if (roomUsage.offTimeCostBdt > roomOffTimeCostThreshold) {
      await upsertActiveAlert({
        alertType: "high_off_time_cost",
        scope: "room",
        roomId: room._id,
        title: "High off-time room cost",
        message: `${room.name} off-time cost is BDT ${roomUsage.offTimeCostBdt}, above BDT ${roomOffTimeCostThreshold}.`,
        severity: "warning",
        dataJson: { offTimeCostBdt: roomUsage.offTimeCostBdt, thresholdBdt: roomOffTimeCostThreshold },
        now
      });
    } else {
      await resolveMatchingAlerts({ alertType: "high_off_time_cost", roomId: room._id, now });
    }
  }

  const officePowerThreshold = await getAlertThresholdNumber("high_office_usage", "powerWatts", 450);
  if (officePowerWatts > officePowerThreshold) {
    await upsertActiveAlert({
      alertType: "high_office_usage",
      scope: "global",
      title: "High office usage",
      message: `Office usage is ${officePowerWatts}W, above the ${officePowerThreshold}W threshold.`,
      severity: "warning",
      dataJson: { currentPowerWatts: officePowerWatts, thresholdWatts: officePowerThreshold },
      now
    });
  } else {
    await resolveMatchingAlerts({ alertType: "high_office_usage", now });
  }

  const officeUsage = await summarizeRange(todayStart, now);
  const officeOffTimeCostThreshold = await getAlertThresholdNumber("high_off_time_cost", "bdt", 100);
  if (officeUsage.offTimeCostBdt > officeOffTimeCostThreshold) {
    await upsertActiveAlert({
      alertType: "high_off_time_cost",
      scope: "global",
      title: "High off-time office cost",
      message: `Office off-time cost is BDT ${officeUsage.offTimeCostBdt}, above BDT ${officeOffTimeCostThreshold}.`,
      severity: "warning",
      dataJson: { offTimeCostBdt: officeUsage.offTimeCostBdt, thresholdBdt: officeOffTimeCostThreshold },
      now
    });
  } else {
    await resolveMatchingAlerts({ alertType: "high_off_time_cost", now });
  }

  const monthlyEstimate = await estimatedMonthlyBill(now);
  const monthlyThreshold = await getAlertThresholdNumber("high_monthly_estimate", "bdt", 5000);
  if (monthlyEstimate > monthlyThreshold) {
    await upsertActiveAlert({
      alertType: "high_monthly_estimate",
      scope: "global",
      title: "High monthly bill estimate",
      message: `Estimated monthly bill is BDT ${monthlyEstimate}, above BDT ${monthlyThreshold}.`,
      severity: "warning",
      dataJson: { estimatedMonthlyBillBdt: monthlyEstimate, thresholdBdt: monthlyThreshold },
      now
    });
  } else {
    await resolveMatchingAlerts({ alertType: "high_monthly_estimate", now });
  }
}

export async function getEffectiveAlertSetting(alertType: string, roomId?: unknown, deviceId?: unknown) {
  if (deviceId) {
    const deviceSetting = await AlertSetting.findOne({ scope: "device", deviceId, alertType });
    if (deviceSetting) {
      return deviceSetting;
    }

    const device = await Device.findById(deviceId);
    if (device?.roomId) {
      const roomSetting = await AlertSetting.findOne({ scope: "room", roomId: device.roomId, alertType });
      if (roomSetting) {
        return roomSetting;
      }
    }
  }

  if (roomId) {
    const roomSetting = await AlertSetting.findOne({ scope: "room", roomId, alertType });
    if (roomSetting) {
      return roomSetting;
    }
  }

  return AlertSetting.findOne({ scope: "global", roomId: null, deviceId: null, alertType });
}

export async function getAlertThresholdNumber(
  alertType: string,
  field: string,
  fallback: number,
  roomId?: unknown,
  deviceId?: unknown
): Promise<number> {
  const setting = await getEffectiveAlertSetting(alertType, roomId, deviceId);
  const value = setting?.thresholdJson && typeof setting.thresholdJson === "object"
    ? (setting.thresholdJson as Record<string, unknown>)[field]
    : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function assertSupportedAlertScope(alertType: string, scope: "global" | "room" | "device"): void {
  const supported = alertScopeSupport[alertType as keyof typeof alertScopeSupport];
  if (!supported) {
    throw new Error(`Unsupported alert type: ${alertType}`);
  }
  if (!supported.includes(scope as never)) {
    throw new Error(`${alertType} does not support ${scope} alert settings`);
  }
}

function serializeRealtimeAlert(alert: AlertDocument, occurrence: any | null): Record<string, unknown> {
  const plain = typeof alert.toObject === "function" ? alert.toObject() : alert;
  return {
    ...plain,
    id: String(alert._id),
    occurrence: occurrence ? {
      id: String(occurrence._id),
      repeatNumber: occurrence.repeatNumber,
      occurredAt: occurrence.occurredAt.toISOString()
    } : null
  };
}
