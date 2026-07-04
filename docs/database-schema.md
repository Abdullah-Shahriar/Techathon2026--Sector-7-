# OfficePulse AI Database Schema

OfficePulse AI uses MongoDB through Mongoose. MongoDB is the backend source of truth; the frontend, simulator, and Discord bot do not own operational data.

## Core Relationships

```text
Room 1 <- 0..1 Esp32Node
Room 1 <- many Devices
Device 1 <- 1 LatestDeviceState
Device 1 <- many UsageIntervals
Alert 1 <- many AlertOccurrences
Room/Device/Node <- many history and audit records
VisualizerLayout -> room and device IDs as persisted canvas coordinates
```

`Room`, `Device`, and alert references use MongoDB ObjectIds. Hardware-facing `nodeId` and `externalDeviceId` remain stable strings.

## Collections

### `rooms`

Logical office rooms.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Required, trimmed |
| `description` | string | Default empty |
| `isActive` | boolean | Indexed soft-delete flag |
| `archivedAt` | date/null | Archive time |
| `createdAt`, `updatedAt` | date | Mongoose timestamps |

### `esp32_nodes`

Discovered physical or simulated room nodes.

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Required, unique, indexed |
| `roomId` | ObjectId/null | Indexed `Room` reference |
| `status` | enum | `pending`, `active`, `ignored`, `offline`, `archived` |
| `lastSeenAt` | date/null | Last accepted telemetry |
| `lastSequence` | number/null | Last accepted sequence |
| `lastHeartbeatAt` | date/null | Heartbeat tracking |
| `apiKeyHash` | string/null | Reserved node credential hash |

Only one active/offline node may own a room at a time, enforced by service logic.

### `devices`

Backend device catalog discovered from node telemetry.

| Field | Type | Notes |
| --- | --- | --- |
| `externalDeviceId` | string | Hardware-facing ID |
| `nodeId` | string | Indexed owner node |
| `roomId` | ObjectId/null | Indexed room assignment |
| `name` | string | User-editable display name |
| `type` | enum | `fan`, `light`, `other` |
| `expectedPowerWatts` | number/null | Optional alert baseline |
| `isActive` | boolean | Indexed |
| `archivedAt` | date/null | Archive time |

Unique compound index: `{ nodeId, externalDeviceId }`.

### `latest_device_states`

One current electrical state per device.

| Field | Type |
| --- | --- |
| `deviceId` | unique indexed ObjectId |
| `status` | `on` / `off` |
| `voltageVolts` | number |
| `currentAmps` | number |
| `powerWatts` | number |
| `lastChangedAt` | date |
| `onSince` | date/null |
| `lastTelemetryAt` | date |

### `telemetry_events`

Immutable raw ingestion history, including invalid/duplicate events.

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Indexed |
| `sequence` | number/null | Indexed |
| `eventType` | string/null | Indexed |
| `receivedAt` | date | Indexed backend timestamp |
| `payloadJson` | mixed | Original request body |
| `isValid` | boolean | Indexed |
| `error` | string/null | Validation/processing reason |

### `usage_intervals`

Backend-calculated energy intervals used for all analytics.

| Field | Type |
| --- | --- |
| `deviceId` | indexed ObjectId |
| `roomId` | indexed ObjectId/null |
| `roomIdAtTime` | indexed ObjectId/null |
| `startAt`, `endAt` | indexed dates |
| `durationSeconds` | number |
| `averagePowerWatts` | number |
| `averageVoltageVolts` | number |
| `averageCurrentAmps` | number |
| `unitKwh` | number |
| `costBdt` | number |
| `isOfficeTime`, `isOffTime` | indexed booleans |

Indexes support time-range, room-range, and device-range aggregation.

### `alerts`

Current alert threads.

| Field | Type |
| --- | --- |
| `alertType` | indexed string |
| `scope` | `global`, `room`, `device`, `node` |
| `roomId`, `deviceId` | indexed ObjectId/null |
| `nodeId` | indexed string/null |
| `severity` | `info`, `warning`, `critical` |
| `status` | `active`, `resolved`, `acknowledged` |
| `title`, `message` | string |
| `dataJson` | mixed |
| `occurrences` | embedded recent occurrence summaries |
| `createdAt`, `lastRepeatedAt` | date |
| `resolvedAt`, `acknowledgedAt` | date/null |

### `alert_occurrences`

Append-only occurrence history for alert creation/repeats.

| Field | Type |
| --- | --- |
| `alertId` | indexed ObjectId |
| `alertType` | indexed string |
| `occurredAt` | indexed date |
| `message` | string |
| `dataJson` | mixed |
| `notificationStatus` | `pending`, `sent`, `suppressed` |
| `repeatNumber` | number |

### `alert_settings`

Global, room, or device rule overrides.

| Field | Type |
| --- | --- |
| `scope` | `global`, `room`, `device` |
| `roomId`, `deviceId` | indexed ObjectId/null |
| `alertType` | indexed string |
| `enabled` | boolean |
| `severity` | `info`, `warning`, `critical` |
| `thresholdJson` | mixed/null |
| `repeatEveryMinutes` | number/null |

Unique compound index: `{ scope, roomId, deviceId, alertType }`.

### `settings`

Singleton office configuration (`key: "default"`).

| Field | Type |
| --- | --- |
| `key` | unique string |
| `officeStartTime`, `officeEndTime` | `HH:mm` string |
| `timezone` | IANA timezone string |
| `bdtPerUnitKwh` | number |
| `defaultAlertRepeatMinutes` | number |
| `heartbeatTimeoutSeconds` | number |

### `node_sequence_logs`

Sequence processing decisions.

| Field | Type |
| --- | --- |
| `nodeId` | indexed string |
| `sequence` | indexed number |
| `receivedAt` | indexed date |
| `status` | `ok`, `duplicate`, `missed` |

### `node_discovery_events`

Tracks unknown nodes and newly seen devices.

| Field | Type |
| --- | --- |
| `nodeId` | indexed string |
| `externalDeviceId` | indexed string/null |
| `eventType` | `unknown_node`, `new_device` |
| `status` | `pending`, `handled`, `ignored` |
| `firstSeenAt`, `lastSeenAt` | date |
| `dataJson` | mixed |

Unique compound index: `{ nodeId, externalDeviceId, eventType }`.

### `device_room_history`

Audits device movement between rooms with `fromRoomId`, `toRoomId`, `mode`, `reason`, `nodeId`, `externalDeviceId`, and `changedAt`.

### `node_room_history`

Audits node assignment/reassignment with `nodeId`, `fromRoomId`, `toRoomId`, `mode`, `reason`, and `changedAt`.

### `audit_logs`

General management audit trail.

| Field | Type |
| --- | --- |
| `action` | indexed string |
| `resourceType` | indexed string |
| `resourceId` | indexed string/null |
| `actor` | indexed string, default `system` |
| `dataJson` | mixed |
| `createdAt` | indexed date |

### `visualizer_layouts`

Singleton editable floor-plan layout.

| Field | Type | Notes |
| --- | --- | --- |
| `key` | unique string | `"default"` |
| `canvas.width`, `canvas.height` | number | Stable plan coordinate space |
| `rooms[]` | embedded array | `roomId`, `x`, `y`, `width`, `height`, `theme` |
| `devices[]` | embedded array | `deviceId`, `roomId`, `x`, `y` |
| `createdAt`, `updatedAt` | date | Mongoose timestamps |

Room themes are `tile`, `wood`, and `carpet`. The frontend merges newly discovered rooms/devices into the saved layout without changing telemetry records.

## Calculation Ownership

Power measurements enter through telemetry. The backend closes and opens `usage_intervals`, splitting intervals at office-time boundaries where needed. Every dashboard and bot usage figure is aggregated from these stored intervals using the configured timezone and `bdtPerUnitKwh`.
