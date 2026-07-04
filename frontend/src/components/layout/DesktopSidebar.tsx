"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./navItems";

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card/95 backdrop-blur lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b px-6">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground">OfficePulse AI</p>
          <p className="text-lg font-semibold">Energy Ops</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                active && "bg-primary/10 text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4 text-accent" />
            Live operations
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Backend-owned telemetry, cost, alert, and energy data only. Simulator data never powers this UI directly.
          </p>
        </div>
      </div>
    </aside>
  );
}
