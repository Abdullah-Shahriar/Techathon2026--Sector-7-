import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === "active" || normalized === "on" || normalized === "live"
      ? "success"
      : normalized === "critical" || normalized === "offline" || normalized === "archived" || normalized === "ignored"
        ? "destructive"
        : normalized === "warning" || normalized === "pending"
          ? "warning"
          : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
