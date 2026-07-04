import type { AlertSummary } from "@/features/api/types";

export function alertDestination(alert: Partial<Pick<AlertSummary, "id" | "roomId" | "deviceId">>): string {
  const params = new URLSearchParams({ highlightAlert: alert.id ?? "unknown" });
  if (alert.deviceId) {
    params.set("highlightDevice", alert.deviceId);
    return `/devices?${params.toString()}`;
  }
  if (alert.roomId) {
    params.set("highlightRoom", alert.roomId);
    return `/cost?${params.toString()}`;
  }
  return `/alerts?${params.toString()}`;
}

export function navigateToAlert(alert: Partial<Pick<AlertSummary, "id" | "roomId" | "deviceId">>): void {
  if (typeof window === "undefined") return;
  window.location.assign(alertDestination(alert));
}
