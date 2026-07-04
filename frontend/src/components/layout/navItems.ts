import {
  BarChart3,
  BellRing,
  Cpu,
  LayoutDashboard
} from "lucide-react";

export const navItems = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Devices", href: "/devices", icon: Cpu },
  { label: "Cost", href: "/cost", icon: BarChart3 },
  { label: "Alerts", href: "/alerts", icon: BellRing }
];

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/devices": "Devices",
  "/cost": "Cost",
  "/usage": "Cost",
  "/alerts": "Alerts",
  "/settings": "Settings",
  "/visualizer": "Visualizer",
  "/rooms": "Cost",
  "/nodes": "Settings"
};

export function pageTitleForPath(pathname: string): string {
  return routeTitles[pathname] ?? "Overview";
}
