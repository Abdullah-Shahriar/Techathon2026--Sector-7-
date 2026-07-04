"use client";

import { useEffect, useState } from "react";
import { BellRing, MessagesSquare, MousePointerClick } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FrostCard } from "@/components/shared/FrostCard";
import { NotificationToggle } from "@/components/shared/NotificationToggle";
import { notificationPermission } from "@/features/notifications/browserNotifications";

export function NotificationSettingsTab() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  return (
    <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <FrostCard tone="info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-muted-foreground" />Browser notifications</CardTitle>
          <CardDescription>Permission is requested only when you click the enable button.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-background/45 p-3">
            <p className="text-xs text-muted-foreground">Current permission</p>
            <p className="mt-1 font-semibold capitalize">{permission}</p>
          </div>
          <NotificationToggle />
        </CardContent>
      </FrostCard>

      <FrostCard>
        <CardHeader>
          <CardTitle>Notification behavior</CardTitle>
          <CardDescription>How OfficePulse handles new alerts in the browser.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <BehaviorItem icon={<MessagesSquare className="h-4 w-4" />} title="In-app toasts" text="New backend alerts create a frosted toast and update the unread badge." />
          <BehaviorItem icon={<MousePointerClick className="h-4 w-4" />} title="Click routing" text="Toast and browser notification clicks open the affected alert, device, or room view with a temporary highlight." />
          <BehaviorItem icon={<BellRing className="h-4 w-4" />} title="Duplicate protection" text="Notification IDs are saved locally so the same alert occurrence does not repeat as a browser notification." />
        </CardContent>
      </FrostCard>
    </section>
  );
}

function BehaviorItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-background/45 p-3">
      <p className="flex items-center gap-2 font-medium">{icon}{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
