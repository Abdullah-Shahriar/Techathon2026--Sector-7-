"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationPermission, requestNotifications } from "@/features/notifications/browserNotifications";

export function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  async function enable() {
    setPermission(await requestNotifications());
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void enable()} disabled={permission === "granted" || permission === "unsupported"}>
      <BellRing className="h-4 w-4" />
      <span className="hidden sm:inline">{permission === "granted" ? "Notifications on" : "Enable alerts"}</span>
    </Button>
  );
}
