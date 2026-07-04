import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title = "Nothing here yet", description }: { title?: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading live office data" }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-36 items-center justify-center gap-3 p-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {label}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-start gap-3 p-5 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <div>
          <p className="font-medium">Backend unavailable</p>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
