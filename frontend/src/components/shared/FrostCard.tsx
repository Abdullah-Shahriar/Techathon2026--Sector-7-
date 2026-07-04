import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FrostTone = "default" | "energy" | "cost" | "warning" | "info" | "success" | "danger";

const toneClasses: Record<FrostTone, string> = {
  default: "frost-card",
  energy: "frost-card frost-card-energy",
  cost: "frost-card frost-card-cost",
  warning: "frost-card frost-card-warning",
  info: "frost-card frost-card-info",
  success: "frost-card frost-card-success",
  danger: "frost-card frost-card-danger"
};

export function FrostCard({
  tone = "default",
  className,
  children
}: {
  tone?: FrostTone;
  className?: string;
  children: React.ReactNode;
}) {
  return <Card className={cn(toneClasses[tone], className)}>{children}</Card>;
}
