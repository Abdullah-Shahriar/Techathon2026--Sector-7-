import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <Card className={cn(
      "overflow-hidden",
      tone === "warning" && "border-warning/30 bg-warning/5",
      tone === "danger" && "border-destructive/30 bg-destructive/5",
      tone === "success" && "border-success/30 bg-success/5"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
            {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
          </div>
          {Icon && (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{children}</section>;
}
