"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { pageTitleForPath } from "./navItems";
import { usePathname } from "next/navigation";
import { NotificationToggle } from "../shared/NotificationToggle";
import { ThemeToggle } from "../shared/ThemeToggle";

export function TopHeader() {
  const pathname = usePathname();
  const { connectionState, refresh } = useOfficeDataContext();
  const live = connectionState === "live";

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center border-b bg-background px-4">
      <div className="flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex items-center gap-2">
          <div className="hidden h-4 w-px bg-border lg:block" />
          <h1 className="text-base font-semibold tracking-normal">{pageTitleForPath(pathname)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={live ? "outline" : "warning"} className={live ? "bg-background text-foreground" : ""}>
            {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connectionState}
          </Badge>
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
