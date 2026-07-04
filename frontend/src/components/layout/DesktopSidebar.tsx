"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./navItems";

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-muted/40 p-2 lg:flex lg:flex-col">
      <div className="flex h-12 items-center gap-2 rounded-lg px-2">
        <div className="grid h-7 w-7 place-items-center rounded-md border bg-background text-foreground shadow-sm">
          <Command className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">OfficePulse AI</p>
          <p className="truncate text-xs text-muted-foreground">Energy operations</p>
        </div>
      </div>
      <nav className="mt-2 flex-1 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
                active && "bg-background text-foreground shadow-sm"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-lg border bg-background p-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Live operations
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Sector 7 workspace</p>
      </div>
    </aside>
  );
}
