"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock, DollarSign, Save, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FrostCard } from "@/components/shared/FrostCard";
import { TextInputField, NumberInputField, TimeInputField } from "@/components/shared/FormField";
import { api } from "@/features/api/client";
import type { SettingsSummary } from "@/features/api/types";

export function GeneralSettingsTab({
  settings,
  onDone
}: {
  settings: SettingsSummary;
  onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState<SettingsSummary>(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.updateSettings({
        officeStartTime: form.officeStartTime,
        officeEndTime: form.officeEndTime,
        timezone: form.timezone,
        bdtPerUnitKwh: Number(form.bdtPerUnitKwh),
        defaultAlertRepeatMinutes: Number(form.defaultAlertRepeatMinutes),
        heartbeatTimeoutSeconds: Number(form.heartbeatTimeoutSeconds)
      });
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
      <FrostCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            Office policy
          </CardTitle>
          <CardDescription>Tariff, timezone, office hours, heartbeat, and default repeat interval.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <TimeInputField label="Office start" value={form.officeStartTime} onChange={(event) => setForm({ ...form, officeStartTime: event.target.value })} />
            <TimeInputField label="Office end" value={form.officeEndTime} onChange={(event) => setForm({ ...form, officeEndTime: event.target.value })} />
            <TextInputField label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
            <NumberInputField label="BDT per kWh" min={0} step="0.01" value={form.bdtPerUnitKwh} onChange={(event) => setForm({ ...form, bdtPerUnitKwh: Number(event.target.value) })} />
            <NumberInputField label="Default alert repeat minutes" min={1} value={form.defaultAlertRepeatMinutes} onChange={(event) => setForm({ ...form, defaultAlertRepeatMinutes: Number(event.target.value) })} />
            <NumberInputField label="Heartbeat timeout seconds" min={1} value={form.heartbeatTimeoutSeconds} onChange={(event) => setForm({ ...form, heartbeatTimeoutSeconds: Number(event.target.value) })} />
            <Button className="md:col-span-2" disabled={busy}><Save className="h-4 w-4" />Save general settings</Button>
          </form>
        </CardContent>
      </FrostCard>

      <FrostCard tone="info">
        <CardHeader>
          <CardTitle>Current policy</CardTitle>
          <CardDescription>Quick read-only summary of the active backend settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <InfoItem icon={<Clock className="h-4 w-4" />} label="Office window" value={`${form.officeStartTime} - ${form.officeEndTime}`} />
          <InfoItem icon={<DollarSign className="h-4 w-4" />} label="Tariff" value={`BDT ${form.bdtPerUnitKwh}/kWh`} />
          <InfoItem icon={<ShieldCheck className="h-4 w-4" />} label="Heartbeat" value={`${form.heartbeatTimeoutSeconds}s`} />
        </CardContent>
      </FrostCard>
    </section>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <FrostCard className="flex items-center justify-between gap-3 rounded-lg p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <p className="font-medium">{value}</p>
    </FrostCard>
  );
}
