"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navItems } from "./navItems";

const primaryMobileItems = navItems.filter((item) => ["/", "/visualizer", "/rooms", "/devices", "/alerts"].includes(item.href));
const moreMobileItems = navItems.filter((item) => ["/usage", "/nodes", "/settings"].includes(item.href));

export function MobileBottomNav() {
  const pathname = usePathname();
  const moreActive = moreMobileItems.some((item) => item.href === pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 gap-1 border-t bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
      {primaryMobileItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            href={item.href}
            key={item.href}
            className={cn(
              "flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.62rem] font-medium text-muted-foreground",
              active && "bg-accent text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
      <Sheet>
        <SheetTrigger
          className={cn(
            "flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.62rem] font-medium text-muted-foreground",
            moreActive && "bg-accent text-foreground"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>More</span>
        </SheetTrigger>
        <SheetContent className="inset-x-2 inset-y-auto bottom-20 top-auto h-auto w-auto max-w-none grid-rows-none rounded-xl border p-4 sm:w-auto">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {moreMobileItems.map((item) => {
              const Icon = item.icon;
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                      pathname === item.href && "bg-accent text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
