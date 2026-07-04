"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { navItems } from "./navItems";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { unreadAlertCount } = useOfficeDataContext();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t bg-background/80 px-2 py-2 shadow-2xl shadow-black/10 backdrop-blur-xl lg:hidden">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href === "/cost" && pathname === "/usage");
        const Icon = item.icon;
        const showBadge = item.href === "/alerts" && unreadAlertCount > 0;
        return (
          <Link
            href={item.href}
            key={item.href}
            className={cn(
              "relative flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-medium text-muted-foreground",
              active && "frost-card-info text-foreground"
            )}
          >
            <span className="relative">
              <Icon className="h-4 w-4" />
              {showBadge && (
                <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.58rem] font-semibold text-destructive-foreground shadow">
                  {unreadAlertCount > 9 ? "9+" : unreadAlertCount}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
