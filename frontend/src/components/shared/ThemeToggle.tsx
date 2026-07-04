"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme ?? "system"} onValueChange={setTheme}>
      <SelectTrigger className="h-8 w-[116px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light"><span className="inline-flex items-center gap-2"><Sun className="h-4 w-4" />Light</span></SelectItem>
        <SelectItem value="dark"><span className="inline-flex items-center gap-2"><Moon className="h-4 w-4" />Dark</span></SelectItem>
        <SelectItem value="system"><span className="inline-flex items-center gap-2"><Monitor className="h-4 w-4" />System</span></SelectItem>
      </SelectContent>
    </Select>
  );
}

export function CompactThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
