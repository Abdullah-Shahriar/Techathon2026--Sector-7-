import type { AlertSummary } from "../api/types";
import { navigateToAlert } from "../alerts/alertNavigation";

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}

export function notifyForAlert(alert: Partial<AlertSummary> & { occurrence?: { id?: string | null; repeatNumber?: number } }): void {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  const occurrence = alert.occurrence ?? alert.occurrences?.at(-1);
  const key = [
    "officepulse-alert",
    alert.id ?? "unknown",
    occurrence?.id ?? occurrence?.repeatNumber ?? alert.lastRepeatedAt ?? alert.createdAt ?? "first"
  ].join(":");
  if (window.localStorage.getItem(key)) return;
  window.localStorage.setItem(key, "sent");
  const title = alert.title ?? "OfficePulse alert";
  const notification = new Notification(title, {
    body: alert.message ?? alert.alertType ?? "Alert activity changed.",
    tag: key
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
    navigateToAlert(alert as AlertSummary);
  };
}
