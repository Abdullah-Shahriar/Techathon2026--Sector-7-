"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock, DollarSign, Save, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/shared/PageHeader";
import { TextInputField, NumberInputField, TimeInputField } from "@/components/shared/FormField";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { api } from "@/features/api/client";
import type { SettingsSummary } from "@/features/api/types";
import { formatDate } from "@/lib/format";
import { AlertSettingsPanel } from "@/features/alerts/AlertSettingsPanel";

export function SettingsPage() {
  const { state, alertSettings, alertTypes, auditLogs, error, refresh } = useOfficeDataContext();
  const [form, setForm] = useState<SettingsSummary | null>(state?.settings ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state?.settings) setForm(state.settings);
  }, [state?.settings]);

  if (error && !state) return <ErrorState message={error} />;
  if (!state || !form) return <LoadingState />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const currentForm = form;
    if (!currentForm) return;
    setBusy(true);
    try {
      await api.updateSettings({
        officeStartTime: currentForm.officeStartTime,
        officeEndTime: currentForm.officeEndTime,
        timezone: currentForm.timezone,
        bdtPerUnitKwh: Number(currentForm.bdtPerUnitKwh),
        defaultAlertRepeatMinutes: Number(currentForm.defaultAlertRepeatMinutes),
        heartbeatTimeoutSeconds: Number(currentForm.heartbeatTimeoutSeconds)
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Energy policy, tariff, timezone, heartbeat, and alert rules."
      />

      <section className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5 text-muted-foreground" />Office policy</CardTitle>
            <CardDescription>Office time, tariff, timezone, and heartbeat settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <TimeInputField label="Office start" value={form.officeStartTime} onChange={(event) => setForm({ ...form, officeStartTime: event.target.value })} />
              <TimeInputField label="Office end" value={form.officeEndTime} onChange={(event) => setForm({ ...form, officeEndTime: event.target.value })} />
              <TextInputField label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
              <NumberInputField label="BDT per kWh" min={0} step="0.01" value={form.bdtPerUnitKwh} onChange={(event) => setForm({ ...form, bdtPerUnitKwh: Number(event.target.value) })} />
              <NumberInputField label="Default repeat minutes" min={1} value={form.defaultAlertRepeatMinutes} onChange={(event) => setForm({ ...form, defaultAlertRepeatMinutes: Number(event.target.value) })} />
              <NumberInputField label="Heartbeat timeout seconds" min={1} value={form.heartbeatTimeoutSeconds} onChange={(event) => setForm({ ...form, heartbeatTimeoutSeconds: Number(event.target.value) })} />
              <Button className="md:col-span-2" disabled={busy}><Save className="h-4 w-4" />Save system settings</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Light, dark, or system mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThemeToggle />
            <div className="grid gap-3">
              <InfoItem icon={<Clock className="h-4 w-4" />} label="Office window" value={`${form.officeStartTime} - ${form.officeEndTime}`} />
              <InfoItem icon={<DollarSign className="h-4 w-4" />} label="Tariff" value={`BDT ${form.bdtPerUnitKwh}/kWh`} />
              <InfoItem icon={<ShieldCheck className="h-4 w-4" />} label="Heartbeat" value={`${form.heartbeatTimeoutSeconds}s`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <AlertSettingsPanel settings={alertSettings} alertTypes={alertTypes} rooms={state.rooms} devices={state.devices} onDone={refresh} />

      <Card>
        <CardHeader>
          <CardTitle>Audit log preview</CardTitle>
          <CardDescription>Recent management changes recorded by the backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SectionHeader title="Recent activity" />
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log._id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{log.action.replaceAll("_", " ")}</p>
                <p className="text-sm text-muted-foreground">{log.resourceType} / {log.resourceId ?? "system"}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={log.actor} />
                <span className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/25 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <p className="font-medium">{value}</p>
    </div>
  );
}
