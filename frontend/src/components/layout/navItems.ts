import {
  BarChart3,
  BellRing,
  Building2,
  Cpu,
  DoorOpen,
  LayoutDashboard,
  RadioTower,
  Settings
} from "lucide-react";

export const navItems = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Visualizer", href: "/visualizer", icon: Building2 },
  { label: "Rooms", href: "/rooms", icon: DoorOpen },
  { label: "Devices", href: "/devices", icon: Cpu },
  { label: "Usage", href: "/usage", icon: BarChart3 },
  { label: "Alerts", href: "/alerts", icon: BellRing },
  { label: "Nodes", href: "/nodes", icon: RadioTower },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function pageTitleForPath(pathname: string): string {
  const exact = navItems.find((item) => item.href === pathname);
  return exact?.label ?? "Overview";
}
