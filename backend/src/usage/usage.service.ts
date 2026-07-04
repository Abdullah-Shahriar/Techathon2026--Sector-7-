import { z } from "zod";
import { Device, LatestDeviceState, UsageInterval, type LatestDeviceStateDocument, type SettingsDocument } from "../models/index.js";
import {
  addDays,
  addMonthsZoned,
  addYearsZoned,
  daysInZonedMonth,
  isOfficeTime,
  localParts,
  round,
  secondsBetween,
  startOfZonedDay,
  startOfZonedMonth,
  startOfZonedYear,
  timeToMinutes,
  unitKwh,
  zonedDateTimeToUtc,
  type OfficeTimeSettings
} from "../utils/time.js";
import { getSettings } from "../settings/settings.service.js";

const groupByValues = ["second", "minute", "hour", "day", "week", "month", "year", "custom"] as const;

export const usageQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  range: z.enum([
    "today",
    "yesterday",
    "week",
    "this_week",
    "last_7_days",
    "month",
    "this_month",
    "last_30_days",
    "year",
    "this_year",
    "custom"
  ]).default("today"),
  roomId: z.string().optional(),
  deviceId: z.string().optional()
});

export const timelineQuerySchema = usageQuerySchema.extend({
  groupBy: z.enum(groupByValues).default("hour"),
  intervalSeconds: z.coerce.number().int().positive().optional()
});

export interface UsageRecord {
  deviceId: string;
  roomId: string | null;
  startAt: Date;
  endAt: Date;
  durationSeconds: number;
  averagePowerWatts: number;
  averageVoltageVolts: number;
  averageCurrentAmps: number;
  unitKwh: number;
  costBdt: number;
  isOfficeTime: boolean;
  isOffTime: boolean;
}

export interface UsageTotals {
  unitKwh: number;
  costBdt: number;
  officeTimeUnitKwh: number;
  officeTimeCostBdt: number;
  offTimeUnitKwh: number;
  offTimeCostBdt: number;
  averagePowerWatts: number;
  averageVoltageVolts: number;
  averageCurrentAmps: number;
}

interface UsageRange {
  range: string;
  start: Date;
  end: Date;
  filters: {
    roomId?: string;
    deviceId?: string;
  };
}

export async function recordUsageIntervalFromPreviousState(
  previous: LatestDeviceStateDocument | null,
  roomId: unknown,
  receivedAt: Date,
  settings: SettingsDocument
): Promise<void> {
  if (!previous) {
    return;
  }

  const startAt = previous.lastTelemetryAt;
  if (!startAt || startAt.getTime() >= receivedAt.getTime()) {
    return;
  }

  const segments = splitUsageInterval({
    deviceId: String(previous.deviceId),
    roomId: roomId ? String(roomId) : null,
    startAt,
    endAt: receivedAt,
    powerWatts: previous.powerWatts,
    voltageVolts: previous.voltageVolts,
    currentAmps: previous.currentAmps,
    bdtPerUnitKwh: settings.bdtPerUnitKwh,
    settings: settings as unknown as OfficeTimeSettings
  });

  if (segments.length > 0) {
    await UsageInterval.insertMany(segments.map((segment) => ({
      deviceId: previous.deviceId,
      roomId: roomId ?? null,
      roomIdAtTime: roomId ?? null,
      startAt: segment.startAt,
      endAt: segment.endAt,
      durationSeconds: segment.durationSeconds,
      averagePowerWatts: segment.averagePowerWatts,
      averageVoltageVolts: segment.averageVoltageVolts,
      averageCurrentAmps: segment.averageCurrentAmps,
      unitKwh: segment.unitKwh,
      costBdt: segment.costBdt,
      isOfficeTime: segment.isOfficeTime,
      isOffTime: segment.isOffTime
    })));
  }
}

export function splitUsageInterval(input: {
  deviceId: string;
  roomId: string | null;
  startAt: Date;
  endAt: Date;
  powerWatts: number;
  voltageVolts: number;
  currentAmps: number;
  bdtPerUnitKwh: number;
  settings: OfficeTimeSettings;
}): UsageRecord[] {
  if (input.startAt >= input.endAt) {
    return [];
  }

  const boundaries = officeBoundariesBetween(input.startAt, input.endAt, input.settings);
  const cuts = [input.startAt, ...boundaries, input.endAt];
  const records: UsageRecord[] = [];

  for (let index = 0; index < cuts.length - 1; index += 1) {
    const startAt = cuts[index] as Date;
    const endAt = cuts[index + 1] as Date;
    if (startAt >= endAt) {
      continue;
    }

    const durationSeconds = secondsBetween(startAt, endAt);
    const units = unitKwh(input.powerWatts, durationSeconds);
    const midpoint = new Date(startAt.getTime() + (endAt.getTime() - startAt.getTime()) / 2);
    const officeTime = isOfficeTime(midpoint, input.settings);

    records.push({
      deviceId: input.deviceId,
      roomId: input.roomId,
      startAt,
      endAt,
      durationSeconds,
      averagePowerWatts: input.powerWatts,
      averageVoltageVolts: input.voltageVolts,
      averageCurrentAmps: input.currentAmps,
      unitKwh: units,
      costBdt: units * input.bdtPerUnitKwh,
      isOfficeTime: officeTime,
      isOffTime: !officeTime
    });
  }

  return records;
}

export async function getUsageSummary(query: unknown = {}, now = new Date()): Promise<{
  range: string;
  start: string;
  end: string;
  filters: UsageRange["filters"];
  totals: UsageTotals;
  presets: Record<string, UsageTotals>;
}> {
  const settings = await getSettings();
  const usageRange = resolveUsageRange(query, settings.timezone, now);
  const [totals, today, yesterday, thisWeek, last7Days, thisMonth, last30Days, thisYear] = await Promise.all([
    summarizeRange(usageRange.start, usageRange.end, usageRange.filters),
    summarizeResolvedPreset("today", settings.timezone, now, usageRange.filters),
    summarizeResolvedPreset("yesterday", settings.timezone, now, usageRange.filters),
    summarizeResolvedPreset("this_week", settings.timezone, now, usageRange.filters),
    summarizeResolvedPreset("last_7_days", settings.timezone, now, usageRange.filters),
    summarizeResolvedPreset("this_month", settings.timezone, now, usageRange.filters),
    summarizeResolvedPreset("last_30_days", settings.timezone, now, usageRange.filters),
    summarizeResolvedPreset("this_year", settings.timezone, now, usageRange.filters)
  ]);

  return {
    range: usageRange.range,
    start: usageRange.start.toISOString(),
    end: usageRange.end.toISOString(),
    filters: usageRange.filters,
    totals,
    presets: { today, yesterday, this_week: thisWeek, last_7_days: last7Days, this_month: thisMonth, last_30_days: last30Days, this_year: thisYear }
  };
}

export async function getRoomUsage(query: unknown = {}, now = new Date()): Promise<{
  range: string;
  start: string;
  end: string;
  rooms: Array<UsageTotals & { roomId: string | null }>;
}> {
  const settings = await getSettings();
  const usageRange = resolveUsageRange(query, settings.timezone, now);
  const records = await buildUsageRecords(usageRange.start, usageRange.end, usageRange.filters);
  const grouped = groupRecords(records, (record) => record.roomId ?? "unassigned");
  return {
    range: usageRange.range,
    start: usageRange.start.toISOString(),
    end: usageRange.end.toISOString(),
    rooms: [...grouped.entries()].map(([roomId, roomRecords]) => ({
      roomId: roomId === "unassigned" ? null : roomId,
      ...totalsFromRecords(roomRecords)
    }))
  };
}

export async function getDeviceUsage(query: unknown = {}, now = new Date()): Promise<{
  range: string;
  start: string;
  end: string;
  devices: Array<UsageTotals & { deviceId: string }>;
}> {
  const settings = await getSettings();
  const usageRange = resolveUsageRange(query, settings.timezone, now);
  const records = await buildUsageRecords(usageRange.start, usageRange.end, usageRange.filters);
  const grouped = groupRecords(records, (record) => record.deviceId);
  return {
    range: usageRange.range,
    start: usageRange.start.toISOString(),
    end: usageRange.end.toISOString(),
    devices: [...grouped.entries()].map(([deviceId, deviceRecords]) => ({
      deviceId,
      ...totalsFromRecords(deviceRecords)
    }))
  };
}

export async function summarizeRange(
  start: Date,
  end: Date,
  filters: { roomId?: string; deviceId?: string } = {}
): Promise<UsageTotals> {
  return totalsFromRecords(await buildUsageRecords(start, end, filters));
}

export async function getTimeline(query: unknown): Promise<{
  range: string;
  start: string;
  end: string;
  groupBy: string;
  intervalSeconds: number | null;
  filters: UsageRange["filters"];
  buckets: Array<UsageTotals & { start: string; end: string }>;
}> {
  const parsed = timelineQuerySchema.parse(query);
  const settings = await getSettings();
  const usageRange = resolveUsageRange(parsed, settings.timezone);
  const buckets = buildBuckets(usageRange.start, usageRange.end, parsed.groupBy, settings.timezone, parsed.intervalSeconds);

  if (buckets.length > 5000) {
    throw new Error("Timeline query is too large; use a coarser groupBy or shorter range");
  }

  const records = await buildUsageRecords(usageRange.start, usageRange.end, usageRange.filters);
  const timeline = buckets.map((bucket) => {
    const bucketRecords = records
      .map((record) => clipRecord(record, bucket.start, bucket.end))
      .filter((record): record is UsageRecord => record !== null);

    return {
      start: bucket.start.toISOString(),
      end: bucket.end.toISOString(),
      ...totalsFromRecords(bucketRecords)
    };
  });

  return {
    range: usageRange.range,
    start: usageRange.start.toISOString(),
    end: usageRange.end.toISOString(),
    groupBy: parsed.groupBy,
    intervalSeconds: parsed.groupBy === "custom" ? parsed.intervalSeconds ?? 3600 : null,
    filters: usageRange.filters,
    buckets: timeline
  };
}

export async function buildUsageRecords(
  start: Date,
  end: Date,
  filters: { roomId?: string; deviceId?: string } = {}
): Promise<UsageRecord[]> {
  const settings = await getSettings();
  const query: Record<string, unknown> = {
    endAt: { $gt: start },
    startAt: { $lt: end }
  };

  if (filters.roomId) {
    query.roomId = filters.roomId;
  }

  if (filters.deviceId) {
    query.deviceId = filters.deviceId;
  }

  const stored = await UsageInterval.find(query).lean();
  const records = stored.map((interval) => clipRecord({
    deviceId: String(interval.deviceId),
    roomId: interval.roomId ? String(interval.roomId) : null,
    startAt: interval.startAt,
    endAt: interval.endAt,
    durationSeconds: interval.durationSeconds,
    averagePowerWatts: interval.averagePowerWatts,
    averageVoltageVolts: interval.averageVoltageVolts,
    averageCurrentAmps: interval.averageCurrentAmps,
    unitKwh: interval.unitKwh,
    costBdt: interval.costBdt,
    isOfficeTime: interval.isOfficeTime,
    isOffTime: interval.isOffTime
  }, start, end)).filter((record): record is UsageRecord => record !== null);

  const latestQuery: Record<string, unknown> = {
    lastTelemetryAt: { $lt: end }
  };
  if (filters.deviceId) {
    latestQuery.deviceId = filters.deviceId;
  }
  const latestStates = await LatestDeviceState.find(latestQuery).lean();
  const devices = await Device.find({
    _id: { $in: latestStates.map((state) => state.deviceId) },
    ...(filters.roomId ? { roomId: filters.roomId } : {})
  }).lean();
  const roomByDeviceId = new Map(devices.map((device) => [String(device._id), device.roomId ? String(device.roomId) : null]));

  for (const state of latestStates) {
    const deviceId = String(state.deviceId);
    if (!roomByDeviceId.has(deviceId)) {
      continue;
    }

    const ongoingStart = new Date(Math.max(state.lastTelemetryAt.getTime(), start.getTime()));
    if (ongoingStart >= end || state.powerWatts <= 0) {
      continue;
    }

    records.push(...splitUsageInterval({
      deviceId,
      roomId: roomByDeviceId.get(deviceId) ?? null,
      startAt: ongoingStart,
      endAt: end,
      powerWatts: state.powerWatts,
      voltageVolts: state.voltageVolts,
      currentAmps: state.currentAmps,
      bdtPerUnitKwh: settings.bdtPerUnitKwh,
      settings: settings as unknown as OfficeTimeSettings
    }));
  }

  return records;
}

export function totalsFromRecords(records: UsageRecord[]): UsageTotals {
  const durationSeconds = records.reduce((sum, record) => sum + record.durationSeconds, 0);
  const unitTotal = records.reduce((sum, record) => sum + record.unitKwh, 0);
  const costTotal = records.reduce((sum, record) => sum + record.costBdt, 0);
  const officeTimeUnitTotal = records.filter((record) => record.isOfficeTime).reduce((sum, record) => sum + record.unitKwh, 0);
  const officeTimeCostTotal = records.filter((record) => record.isOfficeTime).reduce((sum, record) => sum + record.costBdt, 0);
  const offTimeUnitTotal = records.filter((record) => record.isOffTime).reduce((sum, record) => sum + record.unitKwh, 0);
  const offTimeCostTotal = records.filter((record) => record.isOffTime).reduce((sum, record) => sum + record.costBdt, 0);

  return {
    unitKwh: round(unitTotal, 6),
    costBdt: round(costTotal, 2),
    officeTimeUnitKwh: round(officeTimeUnitTotal, 6),
    officeTimeCostBdt: round(officeTimeCostTotal, 2),
    offTimeUnitKwh: round(offTimeUnitTotal, 6),
    offTimeCostBdt: round(offTimeCostTotal, 2),
    averagePowerWatts: weightedAverage(records, "averagePowerWatts", durationSeconds),
    averageVoltageVolts: weightedAverage(records.filter((record) => record.averageVoltageVolts > 0), "averageVoltageVolts"),
    averageCurrentAmps: weightedAverage(records, "averageCurrentAmps", durationSeconds)
  };
}

export function resolveUsageRange(query: unknown = {}, timezone: string, now = new Date()): UsageRange {
  const parsed = usageQuerySchema.parse(query);
  const filters = {
    ...(parsed.roomId ? { roomId: parsed.roomId } : {}),
    ...(parsed.deviceId ? { deviceId: parsed.deviceId } : {})
  };

  if (parsed.start || parsed.end || parsed.range === "custom") {
    const end = parsed.end ? new Date(parsed.end) : now;
    const start = parsed.start ? new Date(parsed.start) : addDays(end, -1);
    if (start >= end) {
      throw new Error("Usage start must be before end");
    }
    return { range: "custom", start, end, filters };
  }

  const todayStart = startOfZonedDay(now, timezone);
  if (parsed.range === "today") {
    return { range: "today", start: todayStart, end: now, filters };
  }
  if (parsed.range === "yesterday") {
    return { range: "yesterday", start: addDays(todayStart, -1), end: todayStart, filters };
  }
  if (parsed.range === "week" || parsed.range === "last_7_days") {
    return { range: "last_7_days", start: addDays(todayStart, -6), end: now, filters };
  }
  if (parsed.range === "this_week") {
    const local = localParts(now, timezone);
    const dayOfWeek = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return { range: "this_week", start: addDays(todayStart, mondayOffset), end: now, filters };
  }

  if (parsed.range === "month" || parsed.range === "this_month") {
    return { range: "this_month", start: startOfZonedMonth(now, timezone), end: now, filters };
  }

  if (parsed.range === "last_30_days") {
    return { range: "last_30_days", start: addDays(todayStart, -29), end: now, filters };
  }

  return { range: "this_year", start: startOfZonedYear(now, timezone), end: now, filters };
}

function summarizeResolvedPreset(
  range: "today" | "yesterday" | "this_week" | "last_7_days" | "this_month" | "last_30_days" | "this_year",
  timezone: string,
  now: Date,
  filters: UsageRange["filters"]
): Promise<UsageTotals> {
  const usageRange = resolveUsageRange({ range, ...filters }, timezone, now);
  return summarizeRange(usageRange.start, usageRange.end, filters);
}

function weightedAverage(records: UsageRecord[], field: keyof Pick<
  UsageRecord,
  "averagePowerWatts" | "averageVoltageVolts" | "averageCurrentAmps"
>, totalDuration = records.reduce((sum, record) => sum + record.durationSeconds, 0)): number {
  if (records.length === 0 || totalDuration <= 0) {
    return 0;
  }

  const weighted = records.reduce((sum, record) => sum + record[field] * record.durationSeconds, 0);
  return round(weighted / totalDuration, 3);
}

function clipRecord(record: UsageRecord, start: Date, end: Date): UsageRecord | null {
  const clippedStart = new Date(Math.max(record.startAt.getTime(), start.getTime()));
  const clippedEnd = new Date(Math.min(record.endAt.getTime(), end.getTime()));
  if (clippedStart >= clippedEnd) {
    return null;
  }

  const originalDuration = secondsBetween(record.startAt, record.endAt);
  const durationSeconds = secondsBetween(clippedStart, clippedEnd);
  const ratio = originalDuration > 0 ? durationSeconds / originalDuration : 0;

  return {
    ...record,
    startAt: clippedStart,
    endAt: clippedEnd,
    durationSeconds,
    unitKwh: record.unitKwh * ratio,
    costBdt: record.costBdt * ratio
  };
}

function groupRecords<T>(records: T[], keyFn: (record: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const key = keyFn(record);
    const group = map.get(key) ?? [];
    group.push(record);
    map.set(key, group);
  }
  return map;
}

function buildBuckets(
  start: Date,
  end: Date,
  groupBy: (typeof groupByValues)[number],
  timezone: string,
  intervalSeconds?: number
): Array<{ start: Date; end: Date }> {
  if (groupBy === "month" || groupBy === "year") {
    return buildCalendarBuckets(start, end, groupBy, timezone);
  }

  const seconds = groupBy === "custom"
    ? intervalSeconds ?? 3600
    : {
        second: 1,
        minute: 60,
        hour: 3600,
        day: 86400,
        week: 604800
      }[groupBy];
  const buckets = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(Math.min(end.getTime(), cursor.getTime() + seconds * 1000));
    buckets.push({ start: cursor, end: next });
    cursor = next;
  }
  return buckets;
}

function buildCalendarBuckets(
  start: Date,
  end: Date,
  groupBy: "month" | "year",
  timezone: string
): Array<{ start: Date; end: Date }> {
  const buckets = [];
  let cursor = groupBy === "month" ? startOfZonedMonth(start, timezone) : startOfZonedYear(start, timezone);
  if (cursor < start) {
    cursor = groupBy === "month" ? addMonthsZoned(cursor, 1, timezone) : addYearsZoned(cursor, 1, timezone);
  }
  cursor = cursor > start ? start : cursor;

  while (cursor < end) {
    const nextCalendar = groupBy === "month" ? addMonthsZoned(cursor, 1, timezone) : addYearsZoned(cursor, 1, timezone);
    const next = new Date(Math.min(end.getTime(), nextCalendar.getTime()));
    buckets.push({ start: cursor, end: next });
    cursor = next;
  }
  return buckets;
}

function officeBoundariesBetween(start: Date, end: Date, settings: OfficeTimeSettings): Date[] {
  const boundaries = new Set<number>();
  let cursor = addDays(startOfZonedDay(start, settings.timezone), -1);
  const finalDay = addDays(startOfZonedDay(end, settings.timezone), 2);
  const startMinutes = timeToMinutes(settings.officeStartTime);
  const endMinutes = timeToMinutes(settings.officeEndTime);

  while (cursor <= finalDay) {
    const parts = localParts(cursor, settings.timezone);
    for (const minutes of [startMinutes, endMinutes]) {
      const boundary = zonedDateTimeToUtc(
        parts.year,
        parts.month,
        parts.day,
        Math.floor(minutes / 60),
        minutes % 60,
        0,
        settings.timezone
      );
      if (boundary > start && boundary < end) {
        boundaries.add(boundary.getTime());
      }
    }
    cursor = addDays(cursor, 1);
  }

  return [...boundaries].sort((a, b) => a - b).map((value) => new Date(value));
}

export async function estimatedMonthlyBill(now = new Date()): Promise<number> {
  const settings = await getSettings();
  const monthStart = startOfZonedMonth(now, settings.timezone);
  const monthUsage = await summarizeRange(monthStart, now);
  const elapsedDays = Math.max(1, (now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
  const daysInMonth = daysInZonedMonth(now, settings.timezone);
  return round((monthUsage.costBdt / elapsedDays) * daysInMonth, 2);
}
