import { Lightbulb, PlugZap, Wind } from "lucide-react";
import type { DeviceSummary } from "@/features/api/types";
import { cn } from "@/lib/utils";

export function DeviceVisualIcon({ device }: { device: DeviceSummary }) {
  const on = device.status === "on";
  const common = "grid h-12 w-12 place-items-center rounded-full border transition";
  if (device.type === "fan") {
    return (
      <div className={cn(common, on ? "border-primary/50 bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        <Wind className={cn("h-6 w-6", on && "fan-spin")} />
      </div>
    );
  }
  if (device.type === "light") {
    return (
      <div className={cn(common, on ? "border-warning/60 bg-warning/25 text-warning shadow-[0_0_28px_hsl(var(--warning)/0.45)]" : "bg-muted text-muted-foreground")}>
        <Lightbulb className="h-6 w-6" />
      </div>
    );
  }
  return (
    <div className={cn(common, on ? "border-accent/50 bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}>
      <PlugZap className="h-6 w-6" />
    </div>
  );
}
