"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Command, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { navItems } from "./navItems";

export function DesktopSidebar() {
  const pathname = usePathname();
  const { connectionState, state } = useOfficeDataContext();
  const pendingNodes = state?.pendingNodes.length ?? 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-gradient-to-b from-sky-50/80 via-background to-emerald-50/70 p-2 dark:from-sky-950/20 dark:via-background dark:to-emerald-950/20 lg:flex lg:flex-col">
      <div className="flex h-12 items-center gap-2 rounded-lg px-2">
        <div className="grid h-7 w-7 place-items-center rounded-md border bg-background/80 text-foreground shadow-sm backdrop-blur">
          <Command className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">OfficePulse AI</p>
          <p className="truncate text-xs text-muted-foreground">Energy operations</p>
        </div>
      </div>
      <nav className="mt-2 flex-1 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href === "/cost" && pathname === "/usage");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground",
                active && "frost-card text-foreground shadow-sm"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="frost-card mt-auto rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Live operations
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {connectionState === "live" ? "Realtime connected" : `Realtime ${connectionState}`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {pendingNodes ? `${pendingNodes} device node${pendingNodes === 1 ? "" : "s"} waiting` : "All device nodes handled"}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3 w-full bg-background/70">
          <Link href="/settings"><Settings className="h-4 w-4" />Settings</Link>
        </Button>
      </div>
    </aside>
  );
}
