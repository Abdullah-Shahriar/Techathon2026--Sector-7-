import mongoose, { Schema, type Model } from "mongoose";

const objectId = Schema.Types.ObjectId;

const RoomSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, collection: "rooms" }
);

const Esp32NodeSchema = new Schema(
  {
    nodeId: { type: String, required: true, unique: true, index: true, trim: true },
    roomId: { type: objectId, ref: "Room", default: null, index: true },
    status: {
      type: String,
      enum: ["pending", "active", "ignored", "offline"],
      default: "pending",
      index: true
    },
    lastSeenAt: { type: Date, default: null },
    lastSequence: { type: Number, default: null },
    lastHeartbeatAt: { type: Date, default: null },
    apiKeyHash: { type: String, default: null }
  },
  { timestamps: true, collection: "esp32_nodes" }
);

const DeviceSchema = new Schema(
  {
    externalDeviceId: { type: String, required: true, trim: true, index: true },
    roomId: { type: objectId, ref: "Room", default: null, index: true },
    nodeId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["fan", "light", "other"], default: "other", index: true },
    expectedPowerWatts: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true, collection: "devices" }
);
DeviceSchema.index({ nodeId: 1, externalDeviceId: 1 }, { unique: true });

const LatestDeviceStateSchema = new Schema(
  {
    deviceId: { type: objectId, ref: "Device", required: true, unique: true, index: true },
    status: { type: String, enum: ["on", "off"], required: true },
    voltageVolts: { type: Number, required: true },
    currentAmps: { type: Number, required: true },
    powerWatts: { type: Number, required: true },
    lastChangedAt: { type: Date, required: true },
    onSince: { type: Date, default: null },
    lastTelemetryAt: { type: Date, required: true }
  },
  { timestamps: true, collection: "latest_device_states" }
);

const TelemetryEventSchema = new Schema(
  {
    nodeId: { type: String, required: true, index: true },
    sequence: { type: Number, default: null, index: true },
    eventType: { type: String, default: null, index: true },
    receivedAt: { type: Date, required: true, index: true },
    payloadJson: { type: Schema.Types.Mixed, required: true },
    isValid: { type: Boolean, required: true, index: true },
    error: { type: String, default: null }
  },
  { collection: "telemetry_events" }
);

const UsageIntervalSchema = new Schema(
  {
    deviceId: { type: objectId, ref: "Device", required: true, index: true },
    roomId: { type: objectId, ref: "Room", default: null, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    durationSeconds: { type: Number, required: true },
    averagePowerWatts: { type: Number, required: true },
    averageVoltageVolts: { type: Number, required: true },
    averageCurrentAmps: { type: Number, required: true },
    unitKwh: { type: Number, required: true },
    costBdt: { type: Number, required: true },
    isOfficeTime: { type: Boolean, required: true, index: true },
    isOffTime: { type: Boolean, required: true, index: true }
  },
  { timestamps: true, collection: "usage_intervals" }
);

const AlertSchema = new Schema(
  {
    alertType: { type: String, required: true, index: true },
    scope: { type: String, enum: ["global", "room", "device", "node"], required: true, index: true },
    roomId: { type: objectId, ref: "Room", default: null, index: true },
    deviceId: { type: objectId, ref: "Device", default: null, index: true },
    nodeId: { type: String, default: null, index: true },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning" },
    status: { type: String, enum: ["active", "resolved", "acknowledged"], default: "active", index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    dataJson: { type: Schema.Types.Mixed, default: {} },
    occurrences: {
      type: [{
        occurredAt: { type: Date, required: true },
        message: { type: String, required: true },
        dataJson: { type: Schema.Types.Mixed, default: {} },
        repeatNumber: { type: Number, required: true }
      }],
      default: []
    },
    createdAt: { type: Date, default: Date.now, index: true },
    lastRepeatedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "alerts" }
);

const AlertSettingSchema = new Schema(
  {
    scope: { type: String, enum: ["global", "room", "device"], required: true, index: true },
    roomId: { type: objectId, ref: "Room", default: null, index: true },
    deviceId: { type: objectId, ref: "Device", default: null, index: true },
    alertType: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: true },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning" },
    thresholdJson: { type: Schema.Types.Mixed, default: null },
    repeatEveryMinutes: { type: Number, default: null }
  },
  { timestamps: true, collection: "alert_settings" }
);
AlertSettingSchema.index({ scope: 1, roomId: 1, deviceId: 1, alertType: 1 }, { unique: true });

const SettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    officeStartTime: { type: String, required: true },
    officeEndTime: { type: String, required: true },
    timezone: { type: String, required: true },
    bdtPerUnitKwh: { type: Number, required: true },
    defaultAlertRepeatMinutes: { type: Number, required: true },
    heartbeatTimeoutSeconds: { type: Number, required: true }
  },
  { timestamps: true, collection: "settings" }
);

const NodeSequenceLogSchema = new Schema(
  {
    nodeId: { type: String, required: true, index: true },
    sequence: { type: Number, required: true, index: true },
    receivedAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["ok", "duplicate", "missed"], required: true, index: true }
  },
  { collection: "node_sequence_logs" }
);

const NodeDiscoveryEventSchema = new Schema(
  {
    nodeId: { type: String, required: true, index: true },
    externalDeviceId: { type: String, default: null, index: true },
    eventType: { type: String, enum: ["unknown_node", "new_device"], required: true, index: true },
    status: { type: String, enum: ["pending", "handled", "ignored"], default: "pending", index: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    dataJson: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: "node_discovery_events" }
);
NodeDiscoveryEventSchema.index({ nodeId: 1, externalDeviceId: 1, eventType: 1 }, { unique: true });

export type MongoDocument = mongoose.Document & Record<string, any>;
export type RoomDocument = MongoDocument;
export type Esp32NodeDocument = MongoDocument;
export type DeviceDocument = MongoDocument;
export type LatestDeviceStateDocument = MongoDocument;
export type TelemetryEventDocument = MongoDocument;
export type UsageIntervalDocument = MongoDocument;
export type AlertDocument = MongoDocument;
export type AlertSettingDocument = MongoDocument;
export type SettingsDocument = MongoDocument;
export type NodeSequenceLogDocument = MongoDocument;
export type NodeDiscoveryEventDocument = MongoDocument;

function model<T extends MongoDocument>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const Room = model<RoomDocument>("Room", RoomSchema);
export const Esp32Node = model<Esp32NodeDocument>("Esp32Node", Esp32NodeSchema);
export const Device = model<DeviceDocument>("Device", DeviceSchema);
export const LatestDeviceState = model<LatestDeviceStateDocument>("LatestDeviceState", LatestDeviceStateSchema);
export const TelemetryEvent = model<TelemetryEventDocument>("TelemetryEvent", TelemetryEventSchema);
export const UsageInterval = model<UsageIntervalDocument>("UsageInterval", UsageIntervalSchema);
export const Alert = model<AlertDocument>("Alert", AlertSchema);
export const AlertSetting = model<AlertSettingDocument>("AlertSetting", AlertSettingSchema);
export const Settings = model<SettingsDocument>("Settings", SettingsSchema);
export const NodeSequenceLog = model<NodeSequenceLogDocument>("NodeSequenceLog", NodeSequenceLogSchema);
export const NodeDiscoveryEvent = model<NodeDiscoveryEventDocument>("NodeDiscoveryEvent", NodeDiscoveryEventSchema);
