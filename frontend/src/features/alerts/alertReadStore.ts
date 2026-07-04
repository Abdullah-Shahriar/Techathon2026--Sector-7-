import type { AlertSummary } from "@/features/api/types";

const READ_KEY = "officepulse:read-alerts";
const READ_CHANGED_EVENT = "officepulse:alert-read-changed";

export function alertIdentity(alert: Pick<AlertSummary, "id" | "lastRepeatedAt" | "createdAt" | "occurrences">): string {
  const occurrence = alert.occurrences?.at(-1);
  return [
    alert.id,
    occurrence?.id ?? occurrence?.repeatNumber ?? alert.lastRepeatedAt ?? alert.createdAt ?? "first"
  ].join(":");
}

export function readAlertIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function isAlertRead(alert: AlertSummary): boolean {
  return readAlertIds().has(alertIdentity(alert));
}

export function markAlertsRead(alerts: AlertSummary[]): void {
  if (typeof window === "undefined" || alerts.length === 0) return;
  const ids = readAlertIds();
  for (const alert of alerts) ids.add(alertIdentity(alert));
  window.localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)));
  window.dispatchEvent(new CustomEvent(READ_CHANGED_EVENT));
}

export function unreadAlertCount(alerts: AlertSummary[]): number {
  const ids = readAlertIds();
  return alerts.filter((alert) => !ids.has(alertIdentity(alert))).length;
}

export function subscribeAlertReadChanges(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(READ_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(READ_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
