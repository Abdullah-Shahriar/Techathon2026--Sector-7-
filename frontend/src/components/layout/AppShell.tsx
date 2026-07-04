"use client";

import { DesktopSidebar } from "./DesktopSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopHeader } from "./TopHeader";
import { OfficeDataProvider } from "@/features/api/OfficeDataProvider";
import { AlertToastViewport } from "@/features/notifications/notificationManager";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OfficeDataProvider>
      <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.5),transparent_32rem),radial-gradient(circle_at_bottom_right,hsl(var(--success)/0.16),transparent_28rem),hsl(var(--muted)/0.35)]">
        <DesktopSidebar />
        <div className="min-h-svh lg:pl-64">
          <div className="min-h-svh lg:p-2">
            <div className="min-h-svh border bg-background/86 shadow-sm backdrop-blur lg:min-h-[calc(100svh-1rem)] lg:overflow-hidden lg:rounded-xl">
              <TopHeader />
              <main className="mx-auto w-full max-w-[1600px] px-4 py-4 pb-24 md:px-6 md:py-6 lg:pb-8">
                {children}
              </main>
            </div>
          </div>
        </div>
        <MobileBottomNav />
        <AlertToastViewport />
      </div>
    </OfficeDataProvider>
  );
}
