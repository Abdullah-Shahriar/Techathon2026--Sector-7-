"use client";

import { DesktopSidebar } from "./DesktopSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopHeader } from "./TopHeader";
import { OfficeDataProvider } from "@/features/api/OfficeDataProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OfficeDataProvider>
      <div className="min-h-screen bg-background">
        <DesktopSidebar />
        <div className="min-h-screen lg:pl-72">
          <TopHeader />
          <main className="mx-auto w-full max-w-[1680px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </OfficeDataProvider>
  );
}
