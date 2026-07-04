"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { useOfficeDataContext } from "@/features/api/OfficeDataProvider";
import { cn } from "@/lib/utils";
import { GeneralSettingsTab } from "./tabs/GeneralSettingsTab";
import { DeviceNodesSettingsTab } from "./tabs/DeviceNodesSettingsTab";
import { RoomSettingsTab } from "./tabs/RoomSettingsTab";
import { DeviceSettingsTab } from "./tabs/DeviceSettingsTab";
import { AlertSettingsTab } from "./tabs/AlertSettingsTab";
import { NotificationSettingsTab } from "./tabs/NotificationSettingsTab";
import { AppearanceSettingsTab } from "./tabs/AppearanceSettingsTab";
import { AuditSettingsTab } from "./tabs/AuditSettingsTab";

const settingsTabs = [
  { value: "general", label: "General" },
  { value: "device-nodes", label: "Device Nodes" },
  { value: "rooms", label: "Rooms" },
  { value: "devices", label: "Devices" },
  { value: "alerts", label: "Alerts" },
  { value: "notifications", label: "Notifications" },
  { value: "appearance", label: "Appearance" },
  { value: "audit", label: "Audit" }
];

const validTabs = new Set(settingsTabs.map((tab) => tab.value));

export function SettingsPage() {
  const { state, alertSettings, alertTypes, auditLogs, managedRooms, managedDevices, error, refresh } = useOfficeDataContext();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("section") ?? searchParams.get("tab") ?? "general";
  const initialTab = validTabs.has(requestedTab) ? requestedTab : "general";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (validTabs.has(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);

  const activeDescription = useMemo(() => {
    switch (activeTab) {
      case "device-nodes":
        return "Pair, reassign, ignore, archive, and inspect office device nodes.";
      case "rooms":
        return "Rename rooms, archive or restore rooms, and jump into room-level controls.";
      case "devices":
        return "Rename devices, adjust type and expected watts, move rooms, and archive or restore.";
      case "alerts":
        return "Manage global alert defaults and room/device override rules.";
      case "notifications":
        return "Control browser notification permission and review click behavior.";
      case "appearance":
        return "Choose theme and review dashboard visual preferences.";
      case "audit":
        return "Review recent backend management changes.";
      default:
        return "Tariff, timezone, office hours, heartbeat timeout, and default alert interval.";
    }
  }, [activeTab]);

  if (error && !state) return <ErrorState message={error} />;
  if (!state) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description={activeDescription}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="frost-card overflow-x-auto rounded-lg p-1">
          <TabsList className="h-auto w-max justify-start gap-1 bg-transparent p-0">
            {settingsTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "h-10 rounded-md px-3 text-sm",
                  "data-[state=active]:bg-sky-100 data-[state=active]:text-sky-950 data-[state=active]:shadow-sm",
                  "dark:data-[state=active]:bg-sky-400/15 dark:data-[state=active]:text-sky-50"
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="general">
          <GeneralSettingsTab settings={state.settings} onDone={refresh} />
        </TabsContent>

        <TabsContent value="device-nodes">
          <DeviceNodesSettingsTab pendingNodes={state.pendingNodes} nodes={state.nodes} rooms={state.rooms} onDone={refresh} />
        </TabsContent>

        <TabsContent value="rooms">
          <RoomSettingsTab managedRooms={managedRooms} rooms={state.rooms} onDone={refresh} />
        </TabsContent>

        <TabsContent value="devices">
          <DeviceSettingsTab managedDevices={managedDevices} managedRooms={managedRooms} liveDevices={state.devices} onDone={refresh} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertSettingsTab settings={alertSettings} alertTypes={alertTypes} rooms={state.rooms} devices={state.devices} onDone={refresh} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsTab />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceSettingsTab />
        </TabsContent>

        <TabsContent value="audit">
          <AuditSettingsTab auditLogs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
