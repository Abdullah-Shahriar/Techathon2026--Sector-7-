import { Alert, Device, Esp32Node, LatestDeviceState, Room } from "../models/index.js";
import { buildUsageRecords, totalsFromRecords, type UsageRecord, type UsageTotals } from "../usage/usage.service.js";
import { getSettings } from "../settings/settings.service.js";
import { addDays, daysInZonedMonth, round, startOfZonedDay, startOfZonedMonth } from "../utils/time.js";

export async function getOfficeState(now = new Date()): Promise<unknown> {
  const settings = await getSettings();
  const [rooms, nodes, devices, latestStates, activeAlerts] = await Promise.all([
    Room.find({ isActive: true }).sort({ name: 1 }).lean(),
    Esp32Node.find({}).sort({ createdAt: -1 }).lean(),
    Device.find({ isActive: true }).sort({ nodeId: 1, externalDeviceId: 1 }).lean(),
    LatestDeviceState.find({}).lean(),
    Alert.find({ status: "active" }).sort({ createdAt: -1 }).limit(100).lean()
  ]);

  const latestByDeviceId = new Map(latestStates.map((state) => [String(state.deviceId), state]));
  const todayStart = startOfZonedDay(now, settings.timezone);
  const monthStart = startOfZonedMonth(now, settings.timezone);
  const [todayRecords, monthRecords] = await Promise.all([
    buildUsageRecords(todayStart, now),
    buildUsageRecords(monthStart, now)
  ]);
  const officeToday = totalsFromRecords(todayRecords);
  const officeMonth = totalsFromRecords(monthRecords);
  const usageByDeviceId = groupUsageTotals(todayRecords, (record) => record.deviceId);
  const usageByRoomId = groupUsageTotals(todayRecords, (record) => record.roomId);
  const elapsedMonthDays = Math.max(1, (now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
  const estimatedMonthlyBillBdt = round((officeMonth.costBdt / elapsedMonthDays) * daysInZonedMonth(now, settings.timezone), 2);

  const devicesWithState = await Promise.all(devices.map(async (device) => {
    const state = latestByDeviceId.get(String(device._id));
    const todayUsage = usageByDeviceId.get(String(device._id)) ?? emptyUsageTotals();
    const onDurationSeconds = state?.onSince ? Math.max(0, Math.round((now.getTime() - state.onSince.getTime()) / 1000)) : 0;

    return {
      id: String(device._id),
      externalDeviceId: device.externalDeviceId,
      name: device.name,
      type: device.type,
      roomId: device.roomId ? String(device.roomId) : null,
      nodeId: device.nodeId,
      status: state?.status ?? "off",
      voltageVolts: state?.voltageVolts ?? 0,
      currentAmps: state?.currentAmps ?? 0,
      powerWatts: state?.powerWatts ?? 0,
      expectedPowerWatts: device.expectedPowerWatts ?? null,
      unitKwhToday: todayUsage.unitKwh,
      costBdtToday: todayUsage.costBdt,
      officeTimeUnitKwhToday: todayUsage.officeTimeUnitKwh,
      officeTimeCostBdtToday: todayUsage.officeTimeCostBdt,
      offTimeUnitKwhToday: todayUsage.offTimeUnitKwh,
      offTimeCostBdtToday: todayUsage.offTimeCostBdt,
      lastChangedAt: state?.lastChangedAt?.toISOString() ?? null,
      onSince: state?.onSince?.toISOString() ?? null,
      onDurationSeconds,
      lastTelemetryAt: state?.lastTelemetryAt?.toISOString() ?? null
    };
  }));

  const roomSummaries = await Promise.all(rooms.map(async (room) => {
    const roomDevices = devicesWithState.filter((device) => device.roomId === String(room._id));
    const roomUsage = usageByRoomId.get(String(room._id)) ?? emptyUsageTotals();
    const currentPowerWatts = roomDevices.reduce((sum, device) => sum + device.powerWatts, 0);
    const poweredVoltages = roomDevices.map((device) => device.voltageVolts).filter((voltage) => voltage > 0);
    const averageVoltageVolts = poweredVoltages.length
      ? round(poweredVoltages.reduce((sum, voltage) => sum + voltage, 0) / poweredVoltages.length, 3)
      : 0;

    return {
      roomId: String(room._id),
      name: room.name,
      description: room.description,
      deviceCount: roomDevices.length,
      activeDeviceCount: roomDevices.filter((device) => device.status === "on").length,
      currentPowerWatts,
      approxCurrentAmps: averageVoltageVolts > 0 ? round(currentPowerWatts / averageVoltageVolts, 3) : 0,
      averageVoltageVolts,
      unitKwhToday: roomUsage.unitKwh,
      costBdtToday: roomUsage.costBdt,
      officeTimeUnitKwhToday: roomUsage.officeTimeUnitKwh,
      officeTimeCostBdtToday: roomUsage.officeTimeCostBdt,
      offTimeUnitKwhToday: roomUsage.offTimeUnitKwh,
      offTimeCostBdtToday: roomUsage.offTimeCostBdt
    };
  }));

  const roomlessDevices = devicesWithState.filter((device) => !device.roomId);
  const allPoweredVoltages = devicesWithState.map((device) => device.voltageVolts).filter((voltage) => voltage > 0);
  const currentPowerWatts = devicesWithState.reduce((sum, device) => sum + device.powerWatts, 0);
  const averageVoltageVolts = allPoweredVoltages.length
    ? round(allPoweredVoltages.reduce((sum, voltage) => sum + voltage, 0) / allPoweredVoltages.length, 3)
    : 0;

  return {
    nodes: (nodes as any[]).map((node) => serializeNode(node)),
    pendingNodes: (nodes as any[]).filter((node) => node.status === "pending").map((node) => serializeNode(node)),
    rooms: roomSummaries,
    devices: devicesWithState,
    unassignedDevices: roomlessDevices,
    officeSummary: {
      currentPowerWatts,
      approxCurrentAmps: averageVoltageVolts > 0 ? round(currentPowerWatts / averageVoltageVolts, 3) : 0,
      averageVoltageVolts,
      unitKwhToday: officeToday.unitKwh,
      costBdtToday: officeToday.costBdt,
      unitKwhThisMonth: officeMonth.unitKwh,
      costBdtThisMonth: officeMonth.costBdt,
      estimatedMonthlyBillBdt,
      officeTimeUnitKwhToday: officeToday.officeTimeUnitKwh,
      officeTimeCostBdtToday: officeToday.officeTimeCostBdt,
      offTimeUnitKwhToday: officeToday.offTimeUnitKwh,
      offTimeCostBdtToday: officeToday.offTimeCostBdt
    },
    activeAlerts: activeAlerts.map((alert) => ({
      id: String(alert._id),
      alertType: alert.alertType,
      scope: alert.scope,
      roomId: alert.roomId ? String(alert.roomId) : null,
      deviceId: alert.deviceId ? String(alert.deviceId) : null,
      nodeId: alert.nodeId,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      message: alert.message,
      dataJson: alert.dataJson,
      occurrences: Array.isArray(alert.occurrences)
        ? alert.occurrences.map((occurrence: any) => ({
            id: occurrence.occurrenceId ? String(occurrence.occurrenceId) : occurrence._id ? String(occurrence._id) : null,
            occurredAt: occurrence.occurredAt?.toISOString?.() ?? null,
            message: occurrence.message,
            dataJson: occurrence.dataJson ?? {},
            repeatNumber: occurrence.repeatNumber
          }))
        : [],
      createdAt: alert.createdAt?.toISOString() ?? null,
      lastRepeatedAt: alert.lastRepeatedAt?.toISOString() ?? null
    })),
    settings: {
      id: String(settings._id),
      officeStartTime: settings.officeStartTime,
      officeEndTime: settings.officeEndTime,
      timezone: settings.timezone,
      bdtPerUnitKwh: settings.bdtPerUnitKwh,
      defaultAlertRepeatMinutes: settings.defaultAlertRepeatMinutes,
      heartbeatTimeoutSeconds: settings.heartbeatTimeoutSeconds
    },
    ranges: {
      todayStart: todayStart.toISOString(),
      yesterdayStart: addDays(todayStart, -1).toISOString(),
      monthStart: monthStart.toISOString()
    }
  };
}

function emptyUsageTotals(): UsageTotals {
  return {
    unitKwh: 0,
    costBdt: 0,
    officeTimeUnitKwh: 0,
    officeTimeCostBdt: 0,
    offTimeUnitKwh: 0,
    offTimeCostBdt: 0,
    averagePowerWatts: 0,
    averageVoltageVolts: 0,
    averageCurrentAmps: 0
  };
}

function groupUsageTotals(records: UsageRecord[], keyFn: (record: UsageRecord) => string | null): Map<string | null, UsageTotals> {
  const grouped = new Map<string | null, UsageRecord[]>();
  for (const record of records) {
    const key = keyFn(record);
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }

  return new Map([...grouped.entries()].map(([key, usageRecords]) => [key, totalsFromRecords(usageRecords)]));
}

function serializeNode(node: {
  _id: unknown;
  nodeId: string;
  roomId?: unknown;
  status: string;
  lastSeenAt?: Date | null;
  lastSequence?: number | null;
  lastHeartbeatAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(node._id),
    nodeId: node.nodeId,
    roomId: node.roomId ? String(node.roomId) : null,
    status: node.status,
    lastSeenAt: node.lastSeenAt?.toISOString() ?? null,
    lastSequence: node.lastSequence ?? null,
    lastHeartbeatAt: node.lastHeartbeatAt?.toISOString() ?? null,
    createdAt: node.createdAt?.toISOString() ?? null,
    updatedAt: node.updatedAt?.toISOString() ?? null
  };
}
