"use client";

import { AlertSettingsPanel } from "@/features/alerts/AlertSettingsPanel";
import type { AlertSetting, AlertTypeMetadata, DeviceSummary, RoomSummary } from "@/features/api/types";

export function AlertSettingsTab({
  settings,
  alertTypes,
  rooms,
  devices,
  onDone
}: {
  settings: AlertSetting[];
  alertTypes: AlertTypeMetadata[];
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  onDone: () => Promise<void>;
}) {
  return <AlertSettingsPanel settings={settings} alertTypes={alertTypes} rooms={rooms} devices={devices} onDone={onDone} />;
}
