"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

interface OfficeState {
  nodes: NodeSummary[];
  pendingNodes: NodeSummary[];
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  officeSummary: OfficeSummary;
  activeAlerts: AlertSummary[];
  settings: SettingsSummary;
}

interface NodeSummary {
  id: string;
  nodeId: string;
  roomId: string | null;
  status: string;
  lastSeenAt: string | null;
  lastSequence: number | null;
}

interface RoomSummary {
  roomId: string;
  name: string;
  deviceCount: number;
  activeDeviceCount: number;
  currentPowerWatts: number;
  approxCurrentAmps: number;
  averageVoltageVolts: number;
  unitKwhToday: number;
  costBdtToday: number;
  officeTimeUnitKwhToday: number;
  officeTimeCostBdtToday: number;
  offTimeUnitKwhToday: number;
  offTimeCostBdtToday: number;
}

interface DeviceSummary {
  id: string;
  externalDeviceId: string;
  name: string;
  type: string;
  roomId: string | null;
  nodeId: string;
  status: "on" | "off";
  voltageVolts: number;
  currentAmps: number;
  powerWatts: number;
  unitKwhToday: number;
  costBdtToday: number;
  officeTimeUnitKwhToday: number;
  officeTimeCostBdtToday: number;
  offTimeUnitKwhToday: number;
  offTimeCostBdtToday: number;
  lastChangedAt: string | null;
  onSince: string | null;
  onDurationSeconds: number;
}

interface OfficeSummary {
  currentPowerWatts: number;
  approxCurrentAmps: number;
  averageVoltageVolts: number;
  unitKwhToday: number;
  costBdtToday: number;
  unitKwhThisMonth: number;
  costBdtThisMonth: number;
  estimatedMonthlyBillBdt: number;
  officeTimeUnitKwhToday: number;
  officeTimeCostBdtToday: number;
  offTimeUnitKwhToday: number;
  offTimeCostBdtToday: number;
}

interface AlertSummary {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  createdAt: string | null;
  occurrences?: Array<{
    occurredAt: string | null;
    message: string;
    dataJson?: Record<string, unknown>;
    repeatNumber: number;
  }>;
}

interface SettingsSummary {
  officeStartTime: string;
  officeEndTime: string;
  timezone: string;
  bdtPerUnitKwh: number;
  defaultAlertRepeatMinutes: number;
  heartbeatTimeoutSeconds: number;
}

interface AlertSetting {
  _id: string;
  scope: "global" | "room" | "device";
  roomId: string | null;
  deviceId: string | null;
  alertType: string;
  enabled: boolean;
  severity: "info" | "warning" | "critical";
  thresholdJson: Record<string, unknown> | null;
  repeatEveryMinutes: number | null;
}

interface TimelineBucket {
  start: string;
  end: string;
  unitKwh: number;
  costBdt: number;
  averagePowerWatts: number;
}

interface TimelineResponse {
  range: string;
  start: string;
  end: string;
  groupBy: string;
  intervalSeconds: number | null;
  buckets: TimelineBucket[];
}

interface UsageTotals {
  unitKwh: number;
  costBdt: number;
  officeTimeUnitKwh: number;
  officeTimeCostBdt: number;
  offTimeUnitKwh: number;
  offTimeCostBdt: number;
  averagePowerWatts: number;
  averageVoltageVolts: number;
  averageCurrentAmps: number;
}

interface UsageSummaryResponse {
  range: string;
  start: string;
  end: string;
  totals: UsageTotals;
  presets: Record<string, UsageTotals>;
}

interface RoomUsageResponse {
  range: string;
  start: string;
  end: string;
  rooms: Array<UsageTotals & { roomId: string | null }>;
}

interface DeviceUsageResponse {
  range: string;
  start: string;
  end: string;
  devices: Array<UsageTotals & { deviceId: string }>;
}

const alertTypes = [
  "off_time_device_on",
  "esp32_offline",
  "missing_heartbeat",
  "esp32_back_online",
  "unknown_esp32_discovered",
  "new_device_discovered",
  "missed_telemetry_sequence",
  "device_on_power_zero",
  "device_off_power_flowing",
  "abnormal_high_power",
  "high_room_usage",
  "high_office_usage",
  "high_off_time_cost",
  "high_monthly_estimate"
];

export default function DashboardPage() {
  const [state, setState] = useState<OfficeState | null>(null);
  const [alertSettings, setAlertSettings] = useState<AlertSetting[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummaryResponse | null>(null);
  const [roomUsage, setRoomUsage] = useState<RoomUsageResponse | null>(null);
  const [deviceUsage, setDeviceUsage] = useState<DeviceUsageResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [status, setStatus] = useState("Connecting");
  const [error, setError] = useState<string | null>(null);
  const [usageRange, setUsageRange] = useState("today");
  const [usageStart, setUsageStart] = useState("");
  const [usageEnd, setUsageEnd] = useState("");
  const [timelineGroupBy, setTimelineGroupBy] = useState("hour");
  const [intervalSeconds, setIntervalSeconds] = useState(3600);
  const [usageRoomId, setUsageRoomId] = useState("");
  const [usageDeviceId, setUsageDeviceId] = useState("");
  const refreshInFlightRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  const usageQuery = useMemo(() => buildUsageQuery({
    range: usageRange,
    start: usageStart,
    end: usageEnd,
    groupBy: timelineGroupBy,
    intervalSeconds,
    roomId: usageRoomId,
    deviceId: usageDeviceId
  }), [usageRange, usageStart, usageEnd, timelineGroupBy, intervalSeconds, usageRoomId, usageDeviceId]);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const [stateData, settingsData, summaryData, roomUsageData, deviceUsageData, timelineData] = await Promise.all([
        apiGet<OfficeState>("/api/state"),
        apiGet<AlertSetting[]>("/api/alerts/settings"),
        apiGet<UsageSummaryResponse>(`/api/usage/summary?${usageQuery.summary}`),
        apiGet<RoomUsageResponse>(`/api/usage/rooms?${usageQuery.summary}`),
        apiGet<DeviceUsageResponse>(`/api/usage/devices?${usageQuery.summary}`),
        apiGet<TimelineResponse>(`/api/usage/timeline?${usageQuery.timeline}`)
      ]);
      setState(stateData);
      setAlertSettings(settingsData);
      setUsageSummary(summaryData);
      setRoomUsage(roomUsageData);
      setDeviceUsage(deviceUsageData);
      setTimeline(timelineData);
      setStatus("Live");
      setError(null);
    } catch (requestError) {
      setStatus("Backend unavailable");
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [usageQuery]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 350);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    let socket: Socket | null = io(backendUrl, { transports: ["websocket", "polling"] });
    const refreshEvents = [
      "office_state_updated",
      "device_state_changed",
      "usage_updated",
      "alert_created",
      "alert_resolved",
      "node_discovered",
      "node_online",
      "node_offline",
      "settings_updated"
    ];
    refreshEvents.forEach((event) => socket?.on(event, scheduleRefresh));
    socket.on("connect", () => setStatus("Live"));
    socket.on("disconnect", () => setStatus("Polling"));
    return () => {
      window.clearInterval(interval);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      socket?.disconnect();
      socket = null;
    };
  }, [refresh, scheduleRefresh]);

  const roomOptions = useMemo(() => state?.rooms ?? [], [state]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">OfficePulse AI</p>
          <h1>Backend Verification Dashboard</h1>
        </div>
        <div className="connection">
          <span className={`dot ${status === "Live" ? "ok" : "warn"}`} />
          <span>{status}</span>
        </div>
      </header>

      {error && <div className="notice">{error}</div>}

      <section className="summary-grid">
        <Metric label="Current Power" value={`${state?.officeSummary.currentPowerWatts ?? 0} W`} />
        <Metric label="Current" value={`${state?.officeSummary.approxCurrentAmps ?? 0} A`} />
        <Metric label="Voltage" value={`${state?.officeSummary.averageVoltageVolts ?? 0} V`} />
        <Metric label="Today Units" value={`${formatNumber(state?.officeSummary.unitKwhToday ?? 0, 6)} kWh`} />
        <Metric label="Today Cost" value={`BDT ${formatNumber(state?.officeSummary.costBdtToday ?? 0, 2)}`} />
        <Metric label="This Month Cost" value={`BDT ${formatNumber(state?.officeSummary.costBdtThisMonth ?? 0, 2)}`} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Pending ESP32 Nodes</h2>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
        <div className="node-list">
          {(state?.pendingNodes.length ?? 0) === 0 && <p className="muted">No pending nodes yet.</p>}
          {state?.pendingNodes.map((node) => (
            <NodeActions key={node.nodeId} node={node} rooms={roomOptions} onDone={refresh} />
          ))}
        </div>
      </section>

      <section className="split">
        <section className="panel">
          <h2>Rooms</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Devices</th>
                  <th>Power</th>
                  <th>Units Today</th>
                  <th>Cost Today</th>
                  <th>Off-Time Cost</th>
                </tr>
              </thead>
              <tbody>
                {state?.rooms.map((room) => (
                  <tr key={room.roomId}>
                    <td>{room.name}</td>
                    <td>{room.activeDeviceCount}/{room.deviceCount}</td>
                    <td>{room.currentPowerWatts} W</td>
                    <td>{room.unitKwhToday} kWh</td>
                    <td>BDT {room.costBdtToday}</td>
                    <td>BDT {room.offTimeCostBdtToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Nodes</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Status</th>
                  <th>Sequence</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {state?.nodes.map((node) => (
                  <tr key={node.nodeId}>
                    <td>{node.nodeId}</td>
                    <td><span className={`pill ${node.status}`}>{node.status}</span></td>
                    <td>{node.lastSequence ?? "-"}</td>
                    <td>{formatDate(node.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="panel">
        <h2>Devices</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Node</th>
                <th>Status</th>
                <th>Power</th>
                <th>Current</th>
                <th>Voltage</th>
                <th>Units</th>
                <th>Cost</th>
                <th>On Duration</th>
              </tr>
            </thead>
            <tbody>
              {state?.devices.map((device) => (
                <tr key={device.id}>
                  <td>{device.name}<small>{device.externalDeviceId}</small></td>
                  <td>{device.nodeId}</td>
                  <td><span className={`pill ${device.status}`}>{device.status}</span></td>
                  <td>{device.powerWatts} W</td>
                  <td>{device.currentAmps} A</td>
                  <td>{device.voltageVolts} V</td>
                  <td>{device.unitKwhToday} kWh</td>
                  <td>BDT {device.costBdtToday}</td>
                  <td>{device.onDurationSeconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="split">
        <SettingsPanel settings={state?.settings} onDone={refresh} />
        <UsageControls
          range={usageRange}
          setRange={setUsageRange}
          start={usageStart}
          setStart={setUsageStart}
          end={usageEnd}
          setEnd={setUsageEnd}
          groupBy={timelineGroupBy}
          setGroupBy={setTimelineGroupBy}
          intervalSeconds={intervalSeconds}
          setIntervalSeconds={setIntervalSeconds}
          roomId={usageRoomId}
          setRoomId={setUsageRoomId}
          deviceId={usageDeviceId}
          setDeviceId={setUsageDeviceId}
          rooms={state?.rooms ?? []}
          devices={state?.devices ?? []}
          onApply={refresh}
        />
      </section>

      <UsageResults
        usageSummary={usageSummary}
        roomUsage={roomUsage}
        deviceUsage={deviceUsage}
        timeline={timeline}
        rooms={state?.rooms ?? []}
        devices={state?.devices ?? []}
      />

      <section className="split">
        <section className="panel">
          <h2>Alerts</h2>
          <div className="alert-list">
            {(state?.activeAlerts.length ?? 0) === 0 && <p className="muted">No active alerts.</p>}
            {state?.activeAlerts.map((alert) => (
              <article className="alert-item" key={alert.id}>
                <strong>{alert.title}</strong>
                <span className={`pill ${alert.severity}`}>{alert.severity}</span>
                <p>{alert.message}</p>
                {(alert.occurrences?.length ?? 0) > 0 && (
                  <div className="occurrence-list">
                    {alert.occurrences?.slice(-6).map((occurrence) => (
                      <div className="occurrence-item" key={`${alert.id}-${occurrence.repeatNumber}`}>
                        <span>#{occurrence.repeatNumber}</span>
                        <strong>{formatDate(occurrence.occurredAt)}</strong>
                        <small>{occurrence.message}</small>
                      </div>
                    ))}
                  </div>
                )}
                <div className="actions">
                  <button onClick={() => void patch(`/api/alerts/${alert.id}/acknowledge`, {}).then(refresh)}>Acknowledge</button>
                  <button onClick={() => void patch(`/api/alerts/${alert.id}/resolve`, {}).then(refresh)}>Resolve</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <AlertSettingsPanel
          settings={alertSettings}
          rooms={state?.rooms ?? []}
          devices={state?.devices ?? []}
          onDone={refresh}
        />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function NodeActions({ node, rooms, onDone }: { node: NodeSummary; rooms: RoomSummary[]; onDone: () => Promise<void> }) {
  const [roomName, setRoomName] = useState(suggestRoomNameFromNodeId(node.nodeId));
  const [roomId, setRoomId] = useState(rooms[0]?.roomId ?? "");

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    await post(`/api/nodes/${node.nodeId}/create-room`, { name: roomName });
    await onDone();
  }

  async function assignRoom(event: FormEvent) {
    event.preventDefault();
    if (!roomId) {
      return;
    }
    await post(`/api/nodes/${node.nodeId}/assign-room`, { roomId });
    await onDone();
  }

  return (
    <article className="node-item">
      <div>
        <strong>{node.nodeId}</strong>
        <p>Last sequence {node.lastSequence ?? "-"} · {formatDate(node.lastSeenAt)}</p>
      </div>
      <form onSubmit={createRoom}>
        <input value={roomName} onChange={(event) => setRoomName(event.target.value)} aria-label="Room name" />
        <button>Create Room</button>
      </form>
      <form onSubmit={assignRoom}>
        <select value={roomId} onChange={(event) => setRoomId(event.target.value)} aria-label="Existing room">
          <option value="">Select room</option>
          {rooms.map((room) => <option value={room.roomId} key={room.roomId}>{room.name}</option>)}
        </select>
        <button>Assign</button>
      </form>
      <button onClick={() => void post(`/api/nodes/${node.nodeId}/ignore`, {}).then(onDone)}>Ignore</button>
    </article>
  );
}

function SettingsPanel({ settings, onDone }: { settings?: SettingsSummary; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<SettingsSummary | null>(settings ?? null);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) {
      return;
    }
    await patch("/api/settings", {
      officeStartTime: form.officeStartTime,
      officeEndTime: form.officeEndTime,
      timezone: form.timezone,
      bdtPerUnitKwh: Number(form.bdtPerUnitKwh),
      defaultAlertRepeatMinutes: Number(form.defaultAlertRepeatMinutes),
      heartbeatTimeoutSeconds: Number(form.heartbeatTimeoutSeconds)
    });
    await onDone();
  }

  if (!form) {
    return <section className="panel"><h2>Settings</h2><p className="muted">Loading settings.</p></section>;
  }

  return (
    <section className="panel">
      <h2>Settings</h2>
      <form className="settings-grid" onSubmit={submit}>
        <label>Office Start<input value={form.officeStartTime} onChange={(event) => setForm({ ...form, officeStartTime: event.target.value })} /></label>
        <label>Office End<input value={form.officeEndTime} onChange={(event) => setForm({ ...form, officeEndTime: event.target.value })} /></label>
        <label>Timezone<input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
        <label>BDT / kWh<input type="number" value={form.bdtPerUnitKwh} onChange={(event) => setForm({ ...form, bdtPerUnitKwh: Number(event.target.value) })} /></label>
        <label>Repeat Minutes<input type="number" value={form.defaultAlertRepeatMinutes} onChange={(event) => setForm({ ...form, defaultAlertRepeatMinutes: Number(event.target.value) })} /></label>
        <label>Heartbeat Timeout<input type="number" value={form.heartbeatTimeoutSeconds} onChange={(event) => setForm({ ...form, heartbeatTimeoutSeconds: Number(event.target.value) })} /></label>
        <button>Save Settings</button>
      </form>
    </section>
  );
}

function UsageControls({
  range,
  setRange,
  start,
  setStart,
  end,
  setEnd,
  groupBy,
  setGroupBy,
  intervalSeconds,
  setIntervalSeconds,
  roomId,
  setRoomId,
  deviceId,
  setDeviceId,
  rooms,
  devices,
  onApply
}: {
  range: string;
  setRange: (value: string) => void;
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
  groupBy: string;
  setGroupBy: (value: string) => void;
  intervalSeconds: number;
  setIntervalSeconds: (value: number) => void;
  roomId: string;
  setRoomId: (value: string) => void;
  deviceId: string;
  setDeviceId: (value: string) => void;
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  onApply: () => Promise<void>;
}) {
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onApply();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Usage Explorer</h2>
        <button onClick={() => void onApply()}>Apply</button>
      </div>
      <form className="usage-controls" onSubmit={submit}>
        <label>Range
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            {["today", "yesterday", "week", "month", "year", "custom"].map((value) => (
              <option value={value} key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>Start
          <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>End
          <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
        <label>Group By
          <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
            {["second", "minute", "hour", "day", "week", "month", "year", "custom"].map((value) => (
              <option value={value} key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>Interval Seconds
          <input
            type="number"
            min={1}
            value={intervalSeconds}
            onChange={(event) => setIntervalSeconds(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label>Room Filter
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            <option value="">All rooms</option>
            {rooms.map((room) => <option value={room.roomId} key={room.roomId}>{room.name}</option>)}
          </select>
        </label>
        <label>Device Filter
          <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            <option value="">All devices</option>
            {devices.map((device) => (
              <option value={device.id} key={device.id}>{device.name} ({device.externalDeviceId})</option>
            ))}
          </select>
        </label>
        <button>Refresh Usage</button>
      </form>
    </section>
  );
}

function UsageResults({
  usageSummary,
  roomUsage,
  deviceUsage,
  timeline,
  rooms,
  devices
}: {
  usageSummary: UsageSummaryResponse | null;
  roomUsage: RoomUsageResponse | null;
  deviceUsage: DeviceUsageResponse | null;
  timeline: TimelineResponse | null;
  rooms: RoomSummary[];
  devices: DeviceSummary[];
}) {
  const timelineMaxPower = Math.max(1, ...(timeline?.buckets.map((item) => item.averagePowerWatts) ?? []));
  const totals = usageSummary?.totals;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Usage Results</h2>
          <p className="muted">{usageSummary ? `${formatDate(usageSummary.start)} to ${formatDate(usageSummary.end)}` : "Waiting for backend usage data."}</p>
        </div>
      </div>

      <div className="usage-summary-grid">
        <Metric label="Range Units" value={`${formatNumber(totals?.unitKwh ?? 0, 6)} kWh`} />
        <Metric label="Range Cost" value={`BDT ${formatNumber(totals?.costBdt ?? 0, 2)}`} />
        <Metric label="Office-Time Units" value={`${formatNumber(totals?.officeTimeUnitKwh ?? 0, 6)} kWh`} />
        <Metric label="Off-Time Units" value={`${formatNumber(totals?.offTimeUnitKwh ?? 0, 6)} kWh`} />
        <Metric label="Average Power" value={`${formatNumber(totals?.averagePowerWatts ?? 0, 3)} W`} />
      </div>

      <section className="usage-section">
        <h3>Preset Totals</h3>
        <div className="preset-grid">
          {usageSummary && Object.entries(usageSummary.presets).map(([label, preset]) => (
            <article className="preset-card" key={label}>
              <strong>{label}</strong>
              <span>{formatNumber(preset.unitKwh, 6)} kWh</span>
              <small>BDT {formatNumber(preset.costBdt, 2)}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="split usage-split">
        <div className="table-wrap">
          <h3>Room Usage</h3>
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Units</th>
                <th>Cost</th>
                <th>Office-Time</th>
                <th>Off-Time</th>
                <th>Avg Power</th>
              </tr>
            </thead>
            <tbody>
              {roomUsage?.rooms.map((room) => (
                <tr key={room.roomId ?? "unassigned"}>
                  <td>{rooms.find((item) => item.roomId === room.roomId)?.name ?? room.roomId ?? "Unassigned"}</td>
                  <td>{formatNumber(room.unitKwh, 6)} kWh</td>
                  <td>BDT {formatNumber(room.costBdt, 2)}</td>
                  <td>{formatNumber(room.officeTimeUnitKwh, 6)} kWh</td>
                  <td>{formatNumber(room.offTimeUnitKwh, 6)} kWh</td>
                  <td>{formatNumber(room.averagePowerWatts, 3)} W</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrap">
          <h3>Device Usage</h3>
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Units</th>
                <th>Cost</th>
                <th>Office-Time</th>
                <th>Off-Time</th>
                <th>Avg Current</th>
              </tr>
            </thead>
            <tbody>
              {deviceUsage?.devices.map((device) => {
                const label = devices.find((item) => item.id === device.deviceId);
                return (
                  <tr key={device.deviceId}>
                    <td>{label ? `${label.name} (${label.externalDeviceId})` : device.deviceId}</td>
                    <td>{formatNumber(device.unitKwh, 6)} kWh</td>
                    <td>BDT {formatNumber(device.costBdt, 2)}</td>
                    <td>{formatNumber(device.officeTimeUnitKwh, 6)} kWh</td>
                    <td>{formatNumber(device.offTimeUnitKwh, 6)} kWh</td>
                    <td>{formatNumber(device.averageCurrentAmps, 3)} A</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="usage-section">
        <h3>Timeline</h3>
        <div className="timeline">
          {timeline?.buckets.slice(-48).map((bucket) => (
            <div className="timeline-row" key={`${bucket.start}-${bucket.end}`}>
              <span>{formatDate(bucket.start)}</span>
              <meter min={0} max={timelineMaxPower} value={bucket.averagePowerWatts} />
              <strong>{formatNumber(bucket.unitKwh, 6)} kWh</strong>
              <small>BDT {formatNumber(bucket.costBdt, 2)}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function AlertSettingsPanel({
  settings,
  rooms,
  devices,
  onDone
}: {
  settings: AlertSetting[];
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  onDone: () => Promise<void>;
}) {
  const [scope, setScope] = useState<AlertSetting["scope"]>("global");
  const [roomId, setRoomId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [alertType, setAlertType] = useState(alertTypes[0]);
  const [enabled, setEnabled] = useState(true);
  const [severity, setSeverity] = useState<AlertSetting["severity"]>("warning");
  const [repeatEveryMinutes, setRepeatEveryMinutes] = useState("");
  const [thresholdText, setThresholdText] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (scope === "room" && !roomId && rooms[0]) {
      setRoomId(rooms[0].roomId);
    }
    if (scope === "device" && !deviceId && devices[0]) {
      setDeviceId(devices[0].id);
    }
  }, [scope, roomId, deviceId, rooms, devices]);

  const selectedSetting = useMemo(() => settings.find((setting) => {
    if (setting.scope !== scope || setting.alertType !== alertType) {
      return false;
    }
    if (scope === "room") {
      return setting.roomId === roomId;
    }
    if (scope === "device") {
      return setting.deviceId === deviceId;
    }
    return !setting.roomId && !setting.deviceId;
  }), [settings, scope, alertType, roomId, deviceId]);

  useEffect(() => {
    setEnabled(selectedSetting?.enabled ?? true);
    setSeverity(selectedSetting?.severity ?? "warning");
    setRepeatEveryMinutes(selectedSetting?.repeatEveryMinutes ? String(selectedSetting.repeatEveryMinutes) : "");
    setThresholdText(selectedSetting?.thresholdJson ? JSON.stringify(selectedSetting.thresholdJson) : "");
  }, [selectedSetting]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const thresholdJson = parseThresholdJson(thresholdText);
      await patch("/api/alerts/settings", {
        settings: [{
          id: selectedSetting?._id,
          scope,
          roomId: scope === "room" ? roomId : null,
          deviceId: scope === "device" ? deviceId : null,
          alertType,
          enabled,
          severity,
          thresholdJson,
          repeatEveryMinutes: repeatEveryMinutes.trim() ? Number(repeatEveryMinutes) : null
        }]
      });
      setEditorError(null);
      await onDone();
    } catch (submitError) {
      setEditorError(submitError instanceof Error ? submitError.message : String(submitError));
    }
  }

  async function update(setting: AlertSetting, patchValue: Partial<AlertSetting>) {
    await patch("/api/alerts/settings", {
      settings: [{
        id: setting._id,
        scope: setting.scope,
        roomId: setting.roomId,
        deviceId: setting.deviceId,
        alertType: setting.alertType,
        enabled: patchValue.enabled ?? setting.enabled,
        severity: patchValue.severity ?? setting.severity,
        thresholdJson: setting.thresholdJson,
        repeatEveryMinutes: patchValue.repeatEveryMinutes ?? setting.repeatEveryMinutes
      }]
    });
    await onDone();
  }

  return (
    <section className="panel">
      <h2>Alert Settings</h2>
      {editorError && <div className="notice compact">{editorError}</div>}
      <form className="alert-editor" onSubmit={submit}>
        <label>Scope
          <select value={scope} onChange={(event) => setScope(event.target.value as AlertSetting["scope"])}>
            <option value="global">global</option>
            <option value="room">room</option>
            <option value="device">device</option>
          </select>
        </label>
        {scope === "room" && (
          <label>Room
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              {rooms.map((room) => <option value={room.roomId} key={room.roomId}>{room.name}</option>)}
            </select>
          </label>
        )}
        {scope === "device" && (
          <label>Device
            <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
              {devices.map((device) => (
                <option value={device.id} key={device.id}>{device.name} ({device.externalDeviceId})</option>
              ))}
            </select>
          </label>
        )}
        <label>Alert Type
          <select value={alertType} onChange={(event) => setAlertType(event.target.value)}>
            {alertTypes.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label>Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value as AlertSetting["severity"])}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label>Repeat Minutes
          <input type="number" min={1} value={repeatEveryMinutes} onChange={(event) => setRepeatEveryMinutes(event.target.value)} />
        </label>
        <label>Threshold JSON
          <input value={thresholdText} onChange={(event) => setThresholdText(event.target.value)} placeholder='{"powerWatts":450}' />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enabled
        </label>
        <button>Save Alert Setting</button>
      </form>
      <div className="settings-list">
        {settings.map((setting) => (
          <article className="setting-item" key={setting._id}>
            <strong>{setting.alertType.replaceAll("_", " ")}<small>{setting.scope}</small></strong>
            <label>
              <input type="checkbox" checked={setting.enabled} onChange={(event) => void update(setting, { enabled: event.target.checked })} />
              Enabled
            </label>
            <select value={setting.severity} onChange={(event) => void update(setting, { severity: event.target.value as AlertSetting["severity"] })}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, { cache: "no-store" });
  const json = await readApiEnvelope<T>(response);
  if (!response.ok || !json?.ok) {
    throw new Error(json && !json.ok ? json.error.message : response.statusText);
  }
  return json.data;
}

async function post(path: string, body: unknown): Promise<void> {
  await sendBody("POST", path, body);
}

async function patch(path: string, body: unknown): Promise<void> {
  await sendBody("PATCH", path, body);
}

async function sendBody(method: "POST" | "PATCH", path: string, body: unknown): Promise<void> {
  const response = await fetch(`${backendUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const json = await readApiEnvelope<unknown>(response).catch(() => null);
    throw new Error(json && !json.ok ? json.error.message : response.statusText);
  }
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    const message = text.slice(0, 220).trim() || response.statusText;
    throw new Error(response.ok ? `Backend returned a non-JSON response: ${message}` : message);
  }
}

function buildUsageQuery(input: {
  range: string;
  start: string;
  end: string;
  groupBy: string;
  intervalSeconds: number;
  roomId: string;
  deviceId: string;
}): { summary: string; timeline: string } {
  const summary = new URLSearchParams();
  const startIso = toIsoDateTime(input.start);
  const endIso = toIsoDateTime(input.end);
  summary.set("range", input.range === "custom" || startIso || endIso ? "custom" : input.range);
  if (startIso) {
    summary.set("start", startIso);
  }
  if (endIso) {
    summary.set("end", endIso);
  }
  if (input.roomId) {
    summary.set("roomId", input.roomId);
  }
  if (input.deviceId) {
    summary.set("deviceId", input.deviceId);
  }

  const timeline = new URLSearchParams(summary);
  timeline.set("groupBy", input.groupBy);
  if (input.groupBy === "custom") {
    timeline.set("intervalSeconds", String(Math.max(1, input.intervalSeconds || 1)));
  }

  return {
    summary: summary.toString(),
    timeline: timeline.toString()
  };
}

function toIsoDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
}

function suggestRoomNameFromNodeId(nodeId: string): string {
  const knownRooms: Record<string, string> = {
    "room-node-drawing": "Drawing Room",
    "room-node-work1": "Work Room 1",
    "room-node-work2": "Work Room 2"
  };

  return knownRooms[nodeId] ?? nodeId.replace(/^room-node-/, "").replaceAll("-", " ");
}

function parseThresholdJson(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Threshold JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function formatNumber(value: number, digits: number): string {
  return value.toLocaleString("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 2 ? 0 : Math.min(digits, 2)
  });
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
