export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export interface HealthResponse {
  service?: string;
  mongoReadyState?: number;
  port?: number;
}

export interface OfficeState {
  nodes: NodeSummary[];
  pendingNodes: NodeSummary[];
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  unassignedDevices: DeviceSummary[];
  officeSummary: OfficeSummary;
  activeAlerts: AlertSummary[];
  settings: SettingsSummary;
}

export interface NodeSummary {
  id: string;
  nodeId: string;
  roomId: string | null;
  status: string;
  lastSeenAt: string | null;
  lastSequence: number | null;
  lastHeartbeatAt?: string | null;
}

export interface RoomSummary {
  _id?: string;
  id?: string;
  roomId: string;
  name: string;
  displayName?: string;
  description?: string;
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

export interface DeviceSummary {
  _id?: string;
  id: string;
  externalDeviceId: string;
  name: string;
  displayName?: string;
  type: "fan" | "light" | "other" | string;
  roomId: string | null;
  nodeId: string;
  status: "on" | "off";
  voltageVolts: number;
  currentAmps: number;
  powerWatts: number;
  expectedPowerWatts: number | null;
  unitKwhToday: number;
  costBdtToday: number;
  officeTimeUnitKwhToday: number;
  officeTimeCostBdtToday: number;
  offTimeUnitKwhToday: number;
  offTimeCostBdtToday: number;
  lastChangedAt: string | null;
  onSince: string | null;
  onDurationSeconds: number;
  lastTelemetryAt?: string | null;
}

export interface OfficeSummary {
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

export interface AlertOccurrenceSummary {
  id: string | null;
  occurredAt: string | null;
  message: string;
  dataJson?: Record<string, unknown>;
  repeatNumber: number;
}

export interface AlertSummary {
  id: string;
  alertType: string;
  scope: "global" | "room" | "device" | "node" | string;
  roomId: string | null;
  deviceId: string | null;
  nodeId: string | null;
  severity: "info" | "warning" | "critical" | string;
  status: string;
  title: string;
  message: string;
  dataJson?: Record<string, unknown>;
  createdAt: string | null;
  lastRepeatedAt?: string | null;
  occurrences?: AlertOccurrenceSummary[];
}

export interface SettingsSummary {
  id?: string;
  officeStartTime: string;
  officeEndTime: string;
  timezone: string;
  bdtPerUnitKwh: number;
  defaultAlertRepeatMinutes: number;
  heartbeatTimeoutSeconds: number;
}

export interface UsageTotals {
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

export interface UsageSummaryResponse {
  range: string;
  start: string;
  end: string;
  totals: UsageTotals;
  presets: Record<string, UsageTotals>;
}

export interface RoomUsageResponse {
  range: string;
  start: string;
  end: string;
  rooms: Array<UsageTotals & { roomId: string | null }>;
}

export interface DeviceUsageResponse {
  range: string;
  start: string;
  end: string;
  devices: Array<UsageTotals & { deviceId: string }>;
}

export interface ManagedRoom {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  archivedAt?: string | null;
}

export interface ManagedDevice {
  _id: string;
  externalDeviceId: string;
  name: string;
  type: "fan" | "light" | "other" | string;
  roomId: string | null;
  nodeId: string;
  expectedPowerWatts: number | null;
  isActive?: boolean;
  archivedAt?: string | null;
}
