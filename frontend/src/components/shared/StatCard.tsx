import type { LucideIcon } from "lucide-react";
import { FrostCard } from "./FrostCard";

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
  tone?: "default" | "success" | "warning" | "danger" | "energy" | "cost" | "info";
}) {
  return (
    <FrostCard tone={tone === "danger" ? "danger" : tone} className="overflow-hidden">
      <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="p-4 pt-0">
        <div className="text-2xl font-semibold tracking-normal">{value}</div>
        {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      </div>
    </FrostCard>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{children}</section>;
}
