"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { pageTitleForPath } from "./navItems";
import { usePathname } from "next/navigation";
import { NotificationToggle } from "../shared/NotificationToggle";
import { ThemeToggle } from "../shared/ThemeToggle";

export function TopHeader() {
  const pathname = usePathname();
  const { refresh } = useOfficeDataContext();

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center border-b bg-background px-4">
      <div className="flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex items-center gap-2">
          <div className="hidden h-4 w-px bg-border lg:block" />
          <h1 className="text-base font-semibold tracking-normal">{pageTitleForPath(pathname)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationToggle />
          <ThemeToggle />
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  );
}
