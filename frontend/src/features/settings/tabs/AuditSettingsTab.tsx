"use client";

import { History } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FrostCard } from "@/components/shared/FrostCard";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AuditLog } from "@/features/api/types";
import { formatDate } from "@/lib/format";

export function AuditSettingsTab({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <FrostCard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" />Audit log</CardTitle>
        <CardDescription>Recent settings, device, room, and device-node changes recorded by the backend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {auditLogs.length === 0 ? (
          <EmptyState title="No audit records yet" description="Backend audit entries will appear here after management changes." />
        ) : (
          auditLogs.slice(0, 12).map((log) => (
            <div key={log._id} className="flex flex-col gap-2 rounded-lg border bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{log.action.replaceAll("_", " ")}</p>
                <p className="text-sm text-muted-foreground">{log.resourceType} / {log.resourceId ?? "system"}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={log.actor} />
                <span className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </FrostCard>
  );
}
