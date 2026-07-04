"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./navItems";

const visibleMobileItems = navItems;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
      {visibleMobileItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            href={item.href}
            key={item.href}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.68rem] font-medium text-muted-foreground",
              active && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
