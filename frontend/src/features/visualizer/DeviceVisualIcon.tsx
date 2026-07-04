import { Lightbulb, PlugZap, Wind } from "lucide-react";
import type { DeviceSummary } from "@/features/api/types";
import { cn } from "@/lib/utils";

export function DeviceVisualIcon({ device }: { device: DeviceSummary }) {
  const on = device.status === "on";
  const common = "grid h-12 w-12 place-items-center rounded-md border transition";
  if (device.type === "fan") {
    return (
      <div className={cn(common, on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        <Wind className={cn("h-6 w-6", on && "fan-spin")} />
      </div>
    );
  }
  if (device.type === "light") {
    return (
      <div className={cn(common, on ? "border-warning/60 bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
        <Lightbulb className="h-6 w-6" />
      </div>
    );
  }
  return (
    <div className={cn(common, on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
      <PlugZap className="h-6 w-6" />
    </div>
  );
}
