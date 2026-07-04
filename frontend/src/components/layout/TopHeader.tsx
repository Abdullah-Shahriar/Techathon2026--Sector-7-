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
    <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">OfficePulse AI</p>
          <h1 className="text-2xl font-semibold tracking-normal">{pageTitleForPath(pathname)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={live ? "success" : "warning"}>
            {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connectionState}
          </Badge>
          <NotificationToggle />
          <ThemeToggle />
          <Button onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  );
}
