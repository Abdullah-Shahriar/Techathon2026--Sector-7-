"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlertSummary } from "@/features/api/types";
import { navigateToAlert } from "@/features/alerts/alertNavigation";
import { markAlertsRead } from "@/features/alerts/alertReadStore";

const TOAST_EVENT = "officepulse:alert-toast";

type ToastItem = AlertSummary & { toastId: string };

export function showAlertToast(alert: AlertSummary): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AlertSummary>(TOAST_EVENT, { detail: alert }));
}

export function AlertToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handle(event: Event) {
      const alert = (event as CustomEvent<AlertSummary>).detail;
      const toastId = `${alert.id}:${alert.lastRepeatedAt ?? alert.createdAt ?? Date.now()}`;
      setToasts((current) => current.some((item) => item.toastId === toastId) ? current : [{ ...alert, toastId }, ...current].slice(0, 3));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.toastId !== toastId));
      }, 6000);
    }
    window.addEventListener(TOAST_EVENT, handle);
    return () => window.removeEventListener(TOAST_EVENT, handle);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-3 top-20 z-50 grid w-[min(360px,calc(100vw-1.5rem))] gap-2 lg:right-5">
      {toasts.map((toast) => (
        <button
          key={toast.toastId}
          className={cn(
            "frost-card group rounded-lg p-3 text-left shadow-xl transition hover:-translate-y-0.5",
            toast.severity === "critical" && "frost-card-danger",
            toast.severity === "warning" && "frost-card-warning",
            toast.severity === "info" && "frost-card-info"
          )}
          onClick={() => {
            markAlertsRead([toast]);
            navigateToAlert(toast);
          }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-background/60">
              <BellRing className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{toast.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{toast.message}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-70 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                setToasts((current) => current.filter((item) => item.toastId !== toast.toastId));
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </button>
      ))}
    </div>
  );
}
