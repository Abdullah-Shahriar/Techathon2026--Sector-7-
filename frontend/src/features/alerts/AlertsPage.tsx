"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { ReusableSheet } from "@/components/shared/ReusableSheet";
import { SelectField } from "@/components/shared/FormField";
import { ErrorState, LoadingState, EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NotificationToggle } from "@/components/shared/NotificationToggle";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { api } from "@/features/api/client";
import type { AlertSummary } from "@/features/api/types";
import { formatDate } from "@/lib/format";
import { AlertOccurrencesPanel } from "./AlertOccurrencesPanel";

export function AlertsPage() {
  const { state, error, refresh } = useOfficeDataContext();
  const [acknowledged, setAcknowledged] = useState<AlertSummary[]>([]);
  const [resolved, setResolved] = useState<AlertSummary[]>([]);
  const [severity, setSeverity] = useState("all");

  useEffect(() => {
    void Promise.all([
      api.alerts("acknowledged").then((items) => setAcknowledged(items.map(normalizeAlert))),
      api.alerts("resolved").then((items) => setResolved(items.map(normalizeAlert)))
    ]).catch(() => {
      setAcknowledged([]);
      setResolved([]);
    });
  }, [state?.activeAlerts.length]);

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        description="Active, acknowledged, and resolved operational alerts."
        actions={<NotificationToggle />}
      />

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[240px_1fr]">
          <SelectField
            label="Severity"
            value={severity}
            onValueChange={setSeverity}
            options={[
              { value: "all", label: "All severities" },
              { value: "critical", label: "Critical" },
              { value: "warning", label: "Warning" },
              { value: "info", label: "Info" }
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <AlertStat label="Active" value={state.activeAlerts.length} />
            <AlertStat label="Acknowledged" value={acknowledged.length} />
            <AlertStat label="Resolved" value={resolved.length} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="active">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <AlertList alerts={filterBySeverity(state.activeAlerts, severity)} onDone={refresh} active />
        </TabsContent>
        <TabsContent value="acknowledged">
          <AlertList alerts={filterBySeverity(acknowledged, severity)} onDone={refresh} />
        </TabsContent>
        <TabsContent value="resolved">
          <AlertList alerts={filterBySeverity(resolved, severity)} onDone={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertList({ alerts, active, onDone }: { alerts: AlertSummary[]; active?: boolean; onDone: () => Promise<void> }) {
  if (alerts.length === 0) return <EmptyState title="No alerts in this view" description="Try another status or severity filter." />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {alerts.map((alert) => (
        <ReusableSheet
          key={alert.id}
          title={alert.title}
          description={alert.message}
          trigger={
            <Card className="cursor-pointer transition hover:border-primary/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><BellRing className="h-4 w-4 text-warning" />{alert.title}</CardTitle>
                    <CardDescription className="mt-2">{alert.message}</CardDescription>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{alert.alertType.replaceAll("_", " ")}</span>
                <span>/</span>
                <span>{formatDate(alert.createdAt)}</span>
                {(alert.occurrences?.length ?? 0) > 0 && <span>/ {alert.occurrences?.length} occurrences</span>}
              </CardContent>
            </Card>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Type" value={alert.alertType.replaceAll("_", " ")} />
              <Detail label="Scope" value={alert.scope} />
              <Detail label="Node" value={alert.nodeId ?? "none"} />
              <Detail label="Created" value={formatDate(alert.createdAt)} />
            </div>
            <AlertOccurrencesPanel alert={alert} />
            {active && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => void api.acknowledgeAlert(alert.id).then(onDone)}><CheckCheck className="h-4 w-4" />Acknowledge</Button>
                <Button onClick={() => void api.resolveAlert(alert.id).then(onDone)}><ShieldCheck className="h-4 w-4" />Resolve</Button>
              </div>
            )}
          </div>
        </ReusableSheet>
      ))}
    </div>
  );
}

function AlertStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold capitalize">{value}</p>
    </div>
  );
}

function filterBySeverity(alerts: AlertSummary[], severity: string): AlertSummary[] {
  return severity === "all" ? alerts : alerts.filter((alert) => alert.severity === severity);
}

function normalizeAlert(input: any): AlertSummary {
  return {
    id: String(input.id ?? input._id),
    alertType: input.alertType,
    scope: input.scope,
    roomId: input.roomId ? String(input.roomId) : null,
    deviceId: input.deviceId ? String(input.deviceId) : null,
    nodeId: input.nodeId ?? null,
    severity: input.severity,
    status: input.status,
    title: input.title,
    message: input.message,
    dataJson: input.dataJson ?? {},
    createdAt: input.createdAt ? new Date(input.createdAt).toISOString() : null,
    lastRepeatedAt: input.lastRepeatedAt ? new Date(input.lastRepeatedAt).toISOString() : null,
    occurrences: Array.isArray(input.occurrences)
      ? input.occurrences.map((occurrence: any) => ({
          id: occurrence.id ?? occurrence.occurrenceId ?? occurrence._id ?? null,
          occurredAt: occurrence.occurredAt ? new Date(occurrence.occurredAt).toISOString() : null,
          message: occurrence.message,
          dataJson: occurrence.dataJson ?? {},
          repeatNumber: occurrence.repeatNumber
        }))
      : []
  };
}
