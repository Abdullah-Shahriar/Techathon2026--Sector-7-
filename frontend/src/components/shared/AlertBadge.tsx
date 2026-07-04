import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AlertBadge({ count }: { count: number }) {
  if (count <= 0) {
    return <Badge variant="success">clear</Badge>;
  }
  return (
    <Badge variant={count > 3 ? "destructive" : "warning"}>
      <AlertTriangle className="h-3.5 w-3.5" />
      {count} active
    </Badge>
  );
}
