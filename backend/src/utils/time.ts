export interface OfficeTimeSettings {
  timezone: string;
  officeStartTime: string;
  officeEndTime: string;
}

export function toObjectIdString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }

  return null;
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

export function unitKwh(powerWatts: number, durationSeconds: number): number {
  return powerWatts * (durationSeconds / 3600) / 1000;
}

export function isOfficeTime(date: Date, settings: OfficeTimeSettings): boolean {
  const local = localParts(date, settings.timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const start = timeToMinutes(settings.officeStartTime);
  const end = timeToMinutes(settings.officeEndTime);

  if (start <= end) {
    return currentMinutes >= start && currentMinutes < end;
  }

  return currentMinutes >= start || currentMinutes < end;
}

export function startOfZonedDay(date: Date, timezone: string): Date {
  const parts = localParts(date, timezone);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timezone);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function startOfZonedMonth(date: Date, timezone: string): Date {
  const parts = localParts(date, timezone);
  return zonedDateTimeToUtc(parts.year, parts.month, 1, 0, 0, 0, timezone);
}

export function startOfZonedYear(date: Date, timezone: string): Date {
  const parts = localParts(date, timezone);
  return zonedDateTimeToUtc(parts.year, 1, 1, 0, 0, 0, timezone);
}

export function daysInZonedMonth(date: Date, timezone: string): number {
  const parts = localParts(date, timezone);
  return new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
}

export function addMonthsZoned(date: Date, months: number, timezone: string): Date {
  const parts = localParts(date, timezone);
  return zonedDateTimeToUtc(parts.year, parts.month + months, 1, 0, 0, 0, timezone);
}

export function addYearsZoned(date: Date, years: number, timezone: string): Date {
  const parts = localParts(date, timezone);
  return zonedDateTimeToUtc(parts.year + years, 1, 1, 0, 0, 0, timezone);
}

export function localParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string
): Date {
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const initial = new Date(desiredLocalAsUtc);
  const rendered = localParts(initial, timezone);
  const renderedLocalAsUtc = Date.UTC(
    rendered.year,
    rendered.month - 1,
    rendered.day,
    rendered.hour,
    rendered.minute,
    rendered.second
  );
  const offsetMs = renderedLocalAsUtc - desiredLocalAsUtc;
  return new Date(desiredLocalAsUtc - offsetMs);
}

export function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

export function inferDeviceType(externalDeviceId: string): "fan" | "light" | "other" {
  const normalized = externalDeviceId.toLowerCase();
  if (normalized.includes("fan")) {
    return "fan";
  }

  if (normalized.includes("light")) {
    return "light";
  }

  return "other";
}

export function inferExpectedPowerWatts(type: "fan" | "light" | "other"): number | null {
  if (type === "fan") {
    return 60;
  }

  if (type === "light") {
    return 15;
  }

  return null;
}

export function titleFromDeviceId(externalDeviceId: string): string {
  const segments = externalDeviceId.split("-");
  const type = segments.at(-2) ?? "device";
  const number = segments.at(-1) ?? "";
  return `${capitalize(type)} ${number}`.trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
