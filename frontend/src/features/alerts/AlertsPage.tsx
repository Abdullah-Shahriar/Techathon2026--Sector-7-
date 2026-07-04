"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, ChevronDown, Navigation } from "lucide-react";
import { FrostCard } from "@/components/shared/FrostCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { SelectField } from "@/components/shared/FormField";
import { ErrorState, LoadingState, EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NotificationToggle } from "@/components/shared/NotificationToggle";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import type { AlertSummary } from "@/features/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { alertDestination, navigateToAlert } from "./alertNavigation";
import { isAlertRead } from "./alertReadStore";

export function AlertsPage() {
  const { state, error, markAlertsRead } = useOfficeDataContext();
  const searchParams = useSearchParams();
  const highlightedAlert = searchParams.get("highlightAlert");
  const [severity, setSeverity] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(highlightedAlert);
  const initialReadDone = useRef(false);

  const visibleAlerts = useMemo(() => filterAlerts(state?.activeAlerts ?? [], severity), [state?.activeAlerts, severity]);

  useEffect(() => {
    if (initialReadDone.current || visibleAlerts.length === 0) return;
    initialReadDone.current = true;
    const timer = window.setTimeout(() => markAlertsRead(visibleAlerts), 500);
    return () => window.clearTimeout(timer);
  }, [markAlertsRead, visibleAlerts]);

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  const unreadVisible = visibleAlerts.filter((alert) => !isAlertRead(alert)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Notifications"
        title="Alerts"
        description="A clean list of recent office alerts, with local read state and quick navigation."
        actions={<NotificationToggle />}
      />

      <FrostCard className="rounded-lg p-5">
        <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
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
          <div className="grid grid-cols-2 gap-3">
            <AlertCount label="Visible" value={visibleAlerts.length} />
            <AlertCount label="Unread" value={unreadVisible} />
          </div>
        </div>
      </FrostCard>

      {visibleAlerts.length === 0 ? (
        <EmptyState title="No alerts in this view" description="Try another severity filter." />
      ) : (
        <div className="grid gap-3">
          {visibleAlerts.map((alert) => {
            const read = isAlertRead(alert);
            const expanded = expandedId === alert.id;
            const room = state.rooms.find((item) => item.roomId === alert.roomId);
            const device = state.devices.find((item) => item.id === alert.deviceId);
            return (
              <FrostCard
                key={alert.id}
                tone={severityTone(alert.severity)}
                className={cn("rounded-lg p-4 transition", highlightedAlert === alert.id && "highlight-target", !read && "shadow-lg shadow-warning/15")}
              >
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => {
                      markAlertsRead([alert]);
                      if (alert.deviceId || alert.roomId) {
                        navigateToAlert(alert);
                      } else {
                        setExpandedId(expanded ? null : alert.id);
                      }
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {!read && <span className="h-2.5 w-2.5 rounded-full bg-warning shadow shadow-warning" />}
                      <BellRing className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold">{alert.title}</p>
                      <StatusBadge status={alert.severity} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Room: {room?.name ?? alert.roomId ?? "office"}</span>
                      <span>Device: {device?.name ?? alert.deviceId ?? "none"}</span>
                      <span>Date: {datePart(alert.createdAt)}</span>
                      <span>Time: {timePart(alert.createdAt)}</span>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {(alert.deviceId || alert.roomId) && (
                      <a
                        className="inline-flex h-8 items-center gap-2 rounded-md border bg-background/60 px-3 text-xs font-medium hover:bg-background"
                        href={alertDestination(alert)}
                        onClick={() => markAlertsRead([alert])}
                      >
                        <Navigation className="h-3.5 w-3.5" />Open
                      </a>
                    )}
                    {!alert.deviceId && !alert.roomId && (
                      <button
                        className="inline-flex h-8 items-center gap-2 rounded-md border bg-background/60 px-3 text-xs font-medium hover:bg-background"
                        onClick={() => setExpandedId(expanded ? null : alert.id)}
                      >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")} />Details
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4 rounded-lg border bg-background/45 p-3 text-sm text-muted-foreground">
                    <p>Type: {alert.alertType.replaceAll("_", " ")}</p>
                    <p>Scope: {alert.scope}</p>
                    <p>Created: {formatDate(alert.createdAt)}</p>
                  </div>
                )}
              </FrostCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/45 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function filterAlerts(alerts: AlertSummary[], severity: string): AlertSummary[] {
  return (severity === "all" ? alerts : alerts.filter((alert) => alert.severity === severity))
    .sort((a, b) => Date.parse(b.createdAt ?? "0") - Date.parse(a.createdAt ?? "0"));
}

function severityTone(severity: string): "info" | "warning" | "danger" | "default" {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  if (severity === "info") return "info";
  return "default";
}

function datePart(value: string | null): string {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function timePart(value: string | null): string {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));
}
