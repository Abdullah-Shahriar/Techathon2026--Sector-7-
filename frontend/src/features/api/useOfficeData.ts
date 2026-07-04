"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, backendUrl } from "./client";
import type { AlertSummary, DashboardData, ManagedDevice, ManagedRoom, OfficeState } from "./types";
import { notifyForAlert } from "../notifications/browserNotifications";

const realtimeEvents = [
  "office_state_updated",
  "device_state_changed",
  "usage_updated",
  "alert_resolved",
  "node_discovered",
  "node_online",
  "node_offline",
  "settings_updated"
];

export function useOfficeData() {
  const [data, setData] = useState<DashboardData>({
    state: null,
    alertSettings: [],
    alertTypes: [],
    managedRooms: [],
    managedDevices: [],
    auditLogs: []
  });
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "polling" | "offline">("connecting");
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const refreshTimer = useRef<number | null>(null);
  const hasState = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const state = await loadStateWithRetry();
      const [alertSettings, alertTypes, managedRooms, managedDevices, auditLogs] = await Promise.allSettled([
        api.alertSettings(),
        api.alertTypes(),
        api.managedRooms(),
        api.managedDevices(),
        api.auditLogs()
      ]);
      setData({
        state,
        alertSettings: settledValue(alertSettings, []),
        alertTypes: settledValue(alertTypes, []),
        managedRooms: settledValue(managedRooms, roomsFromState(state)),
        managedDevices: settledValue(managedDevices, devicesFromState(state)),
        auditLogs: settledValue(auditLogs, [])
      });
      hasState.current = true;
      setConnectionState("live");
      setError(null);
    } catch (requestError) {
      setConnectionState((current) => hasState.current ? "polling" : current === "connecting" ? "offline" : current);
      setError(hasState.current ? null : requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void refresh();
    }, 300);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    let socket: Socket | null = io(backendUrl, { transports: ["websocket", "polling"] });
    realtimeEvents.forEach((event) => socket?.on(event, scheduleRefresh));
    socket.on("connect", () => setConnectionState("live"));
    socket.on("disconnect", () => setConnectionState("polling"));
    socket.on("alert_created", (payload: AlertSummary & { occurrence?: { id?: string | null; repeatNumber?: number } }) => {
      notifyForAlert(payload);
      scheduleRefresh();
    });

    return () => {
      window.clearInterval(interval);
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      socket?.disconnect();
      socket = null;
    };
  }, [refresh, scheduleRefresh]);

  return { ...data, connectionState, error, refresh };
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

async function loadStateWithRetry(): Promise<OfficeState> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await api.state();
    } catch (error) {
      lastError = error;
      await delay(350 * (attempt + 1));
    }
  }
  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function roomsFromState(state: OfficeState): ManagedRoom[] {
  return state.rooms.map((room) => ({
    _id: room.roomId,
    name: room.name,
    description: room.description,
    isActive: true,
    archivedAt: null
  }));
}

function devicesFromState(state: OfficeState): ManagedDevice[] {
  return state.devices.map((device) => ({
    _id: device.id,
    externalDeviceId: device.externalDeviceId,
    name: device.name,
    type: device.type,
    roomId: device.roomId,
    nodeId: device.nodeId,
    expectedPowerWatts: device.expectedPowerWatts,
    isActive: true,
    archivedAt: null
  }));
}
