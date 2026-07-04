import type { AlertSummary } from "@/features/api/types";
import { formatDate } from "@/lib/format";

export function AlertOccurrencesPanel({ alert }: { alert: AlertSummary }) {
  const occurrences = alert.occurrences ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{occurrences.length} recorded occurrence{occurrences.length === 1 ? "" : "s"}.</p>
      {occurrences.map((occurrence) => (
        <div key={occurrence.id ?? occurrence.repeatNumber} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Repeat #{occurrence.repeatNumber}</p>
            <p className="text-xs text-muted-foreground">{formatDate(occurrence.occurredAt)}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{occurrence.message}</p>
        </div>
      ))}
    </div>
  );
}
