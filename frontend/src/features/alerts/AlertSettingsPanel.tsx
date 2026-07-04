"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField, TextInputField, NumberInputField } from "@/components/shared/FormField";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/features/api/client";
import type { AlertSetting, AlertTypeMetadata, DeviceSummary, RoomSummary } from "@/features/api/types";

const fallbackAlertTypes: AlertTypeMetadata[] = [
  { alertType: "off_time_device_on", supportedScopes: ["global", "room", "device"] },
  { alertType: "esp32_offline", supportedScopes: ["global", "room"] },
  { alertType: "missing_heartbeat", supportedScopes: ["global", "room"] },
  { alertType: "abnormal_high_power", supportedScopes: ["global", "room", "device"] },
  { alertType: "high_room_usage", supportedScopes: ["global", "room"] },
  { alertType: "high_office_usage", supportedScopes: ["global"] }
];

export function AlertSettingsPanel({
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
  const types = alertTypes.length > 0 ? alertTypes : fallbackAlertTypes;
  const [alertType, setAlertType] = useState(types[0]?.alertType ?? "off_time_device_on");
  const [scope, setScope] = useState<"global" | "room" | "device">("global");
  const [roomId, setRoomId] = useState(rooms[0]?.roomId ?? "none");
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "none");
  const [enabled, setEnabled] = useState("true");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("warning");
  const [repeatEveryMinutes, setRepeatEveryMinutes] = useState("");
  const [thresholdJson, setThresholdJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metadata = types.find((item) => item.alertType === alertType) ?? types[0];
  const supportedScopes = metadata?.supportedScopes ?? ["global"];

  useEffect(() => {
    if (!supportedScopes.includes(scope)) setScope("global");
  }, [scope, supportedScopes]);

  const selected = useMemo(() => settings.find((setting) => {
    if (setting.alertType !== alertType || setting.scope !== scope) return false;
    if (scope === "room") return setting.roomId === roomId;
    if (scope === "device") return setting.deviceId === deviceId;
    return !setting.roomId && !setting.deviceId;
  }), [settings, alertType, scope, roomId, deviceId]);

  useEffect(() => {
    setEnabled(String(selected?.enabled ?? true));
    setSeverity(selected?.severity ?? "warning");
    setRepeatEveryMinutes(selected?.repeatEveryMinutes ? String(selected.repeatEveryMinutes) : "");
    setThresholdJson(selected?.thresholdJson ? JSON.stringify(selected.thresholdJson) : "");
  }, [selected]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.updateAlertSettings({
        settings: [{
          id: selected?._id,
          scope,
          roomId: scope === "room" ? roomId : null,
          deviceId: scope === "device" ? deviceId : null,
          alertType,
          enabled: enabled === "true",
          severity,
          thresholdJson: thresholdJson.trim() ? JSON.parse(thresholdJson) : null,
          repeatEveryMinutes: repeatEveryMinutes.trim() ? Number(repeatEveryMinutes) : null
        }]
      });
      setError(null);
      await onDone();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="frost-card">
      <CardHeader>
        <CardTitle>Alert settings</CardTitle>
        <CardDescription>Global defaults plus room/device overrides, constrained by backend-supported scopes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={submit}>
          <SelectField label="Alert type" value={alertType} onValueChange={setAlertType} options={types.map((item) => ({ value: item.alertType, label: item.alertType.replaceAll("_", " ") }))} />
          <SelectField label="Scope" value={scope} onValueChange={(value) => setScope(value as "global" | "room" | "device")} options={supportedScopes.map((value) => ({ value, label: value }))} />
          <SelectField label="Severity" value={severity} onValueChange={(value) => setSeverity(value as "info" | "warning" | "critical")} options={[{ value: "info", label: "Info" }, { value: "warning", label: "Warning" }, { value: "critical", label: "Critical" }]} />
          {scope === "room" && <SelectField label="Room override" value={roomId} onValueChange={setRoomId} options={rooms.map((room) => ({ value: room.roomId, label: room.name }))} />}
          {scope === "device" && <SelectField label="Device override" value={deviceId} onValueChange={setDeviceId} options={devices.map((device) => ({ value: device.id, label: `${device.name} (${device.externalDeviceId})` }))} />}
          <SelectField label="Enabled" value={enabled} onValueChange={setEnabled} options={[{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }]} />
          <NumberInputField label="Repeat minutes" min={1} value={repeatEveryMinutes} onChange={(event) => setRepeatEveryMinutes(event.target.value)} />
          <TextInputField label="Threshold JSON" value={thresholdJson} onChange={(event) => setThresholdJson(event.target.value)} placeholder='{"powerWatts":450}' />
          <Button className="self-end" disabled={busy}><Save className="h-4 w-4" />Save alert rule</Button>
        </form>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {settings.slice(0, 12).map((setting) => (
            <div key={setting._id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{setting.alertType.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{setting.scope}</p>
                </div>
                <StatusBadge status={setting.enabled ? setting.severity : "disabled"} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
