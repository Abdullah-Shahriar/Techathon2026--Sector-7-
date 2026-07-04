# OfficePulse AI API Schema

Default local base URL: `http://localhost:4000`

## Response Format

Successful:

```json
{ "ok": true, "data": {} }
```

Failed:

```json
{
  "ok": false,
  "error": {
    "message": "Human-readable message",
    "details": {}
  }
}
```

Telemetry ingestion is protected by `x-device-api-key`. Other routes currently do not require application-level authentication.

## Health and State

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service, MongoDB ready state, and listening port |
| `GET` | `/api/state` | Combined nodes, pending nodes, rooms, devices, alerts, settings, and office summary |

## Telemetry

| Method | Path | Auth | Result |
| --- | --- | --- | --- |
| `POST` | `/api/iot/telemetry` | `x-device-api-key` | Validates and queues telemetry; returns `202` |

See [telemetry-contract.md](telemetry-contract.md) for the exact request body.

## Rooms

| Method | Path | Body/query | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/rooms` | `includeInactive=true` optional | List rooms |
| `POST` | `/api/rooms` | `{ "name": "...", "description": "..." }` | Create room |
| `GET` | `/api/rooms/:id` | - | Get room |
| `PATCH` | `/api/rooms/:id` | Any of `name`, `description`, `isActive` | Update room |
| `DELETE` | `/api/rooms/:id` | - | Archive/deactivate room |
| `POST` | `/api/rooms/:id/archive` | `{}` | Archive room and unassign nodes/devices |
| `POST` | `/api/rooms/:id/restore` | `{}` | Restore room |

## ESP32 Nodes

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/nodes` | - | List every known node |
| `GET` | `/api/nodes/pending` | - | List unassigned pending nodes |
| `POST` | `/api/nodes/connect-all` | `{ "roomNamePrefix": "Node", "includeOffline": false }` | Create rooms and connect all eligible nodes |
| `POST` | `/api/nodes/:nodeId/assign-room` | `{ "roomId": "..." }` | Assign node to existing room |
| `POST` | `/api/nodes/:nodeId/create-room` | `{ "name": "...", "description": "..." }` | Create and assign room |
| `POST` | `/api/nodes/:nodeId/unassign` | `{ "moveExistingDevicesFromNow": true }` | Return node to pending |
| `POST` | `/api/nodes/:nodeId/reassign-room` | Reassignment body below | Reassign node |
| `POST` | `/api/nodes/:nodeId/ignore` | `{}` | Ignore node and archive its devices |
| `POST` | `/api/nodes/:nodeId/archive` | `{}` | Archive node |

Reassignment:

```json
{
  "roomId": "mongo-room-id",
  "mode": "future_only",
  "confirmReclassifyHistory": false
}
```

`mode` is one of `future_only`, `move_existing_devices_from_now`, `create_new_devices_for_new_room`, or `reclassify_history`. Reclassifying history requires explicit confirmation.

## Devices

| Method | Path | Body/query | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/devices` | `includeInactive=true` optional | List devices |
| `GET` | `/api/devices/:id` | - | Get device |
| `PATCH` | `/api/devices/:id` | Device update body | Rename/configure device |
| `POST` | `/api/devices/:id/move-room` | `{ "roomId": "..." }` or `null` | Move device |
| `POST` | `/api/devices/:id/archive` | `{}` | Archive device |
| `POST` | `/api/devices/:id/restore` | `{}` | Restore device |

Device update fields: `name`, `type` (`fan`, `light`, `other`), `expectedPowerWatts`, `isActive`, and `roomId`.

## Usage and Cost

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/usage/summary` | Totals and optional preset totals |
| `GET` | `/api/usage/rooms` | Per-room totals |
| `GET` | `/api/usage/devices` | Per-device totals |
| `GET` | `/api/usage/timeline` | Grouped timeline buckets |

Common query parameters:

| Parameter | Values |
| --- | --- |
| `range` | `today`, `yesterday`, `week`, `this_week`, `last_7_days`, `month`, `this_month`, `last_30_days`, `year`, `this_year`, `custom` |
| `start`, `end` | ISO datetime; used for custom ranges |
| `roomId` | MongoDB room ID |
| `deviceId` | MongoDB device ID |
| `includePresets` | Boolean, summary only |
| `groupBy` | `second`, `minute`, `hour`, `day`, `week`, `month`, `year`, `custom` |
| `intervalSeconds` | Positive integer when custom grouping is used |

Usage totals include kWh, BDT cost, office-time/off-time splits, and average power/voltage/current.

## Alerts

| Method | Path | Body/query | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/alerts` | `status` optional | Latest 200 alerts |
| `GET` | `/api/alerts/types` | - | Alert types and supported scopes |
| `GET` | `/api/alerts/settings` | - | Scoped alert configuration |
| `PATCH` | `/api/alerts/settings` | `{ "settings": [...] }` | Upsert settings |
| `GET` | `/api/alerts/:id/occurrences` | - | Latest 500 occurrences |
| `PATCH` | `/api/alerts/:id/acknowledge` | `{}` | Acknowledge alert |
| `PATCH` | `/api/alerts/:id/resolve` | `{}` | Resolve alert |

Alert setting:

```json
{
  "scope": "device",
  "roomId": null,
  "deviceId": "mongo-device-id",
  "alertType": "abnormal_high_power",
  "enabled": true,
  "severity": "warning",
  "thresholdJson": { "powerWatts": 100 },
  "repeatEveryMinutes": 120
}
```

Scopes are `global`, `room`, and `device`. Severities are `info`, `warning`, and `critical`.

## Settings, Layout, and Audit

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/settings` | Read office/time/cost defaults |
| `PATCH` | `/api/settings` | Update office hours, timezone, BDT/kWh, repeat interval, heartbeat timeout |
| `GET` | `/api/visualizer/layout` | Read persisted floor-plan positions |
| `PATCH` | `/api/visualizer/layout` | Save canvas, room, and device positions |
| `GET` | `/api/audit-logs` | Filtered audit history |

Visualizer layout:

```json
{
  "canvas": { "width": 1200, "height": 720 },
  "rooms": [
    {
      "roomId": "mongo-room-id",
      "x": 18,
      "y": 18,
      "width": 388,
      "height": 390,
      "theme": "tile"
    }
  ],
  "devices": [
    {
      "deviceId": "mongo-device-id",
      "roomId": "mongo-room-id",
      "x": 120,
      "y": 100
    }
  ]
}
```

## Socket.IO Events

| Event | Meaning |
| --- | --- |
| `connected` | Socket handshake confirmation |
| `office_state_updated` | Telemetry or management changed office state |
| `device_state_changed` | A device changed status |
| `usage_updated` | New usage data is available |
| `alert_created` | New or repeated alert occurrence |
| `alert_resolved` | Alert is no longer active |
| `node_discovered` | Unknown node appeared |
| `node_online` | Node returned online |
| `node_offline` | Heartbeat timeout marked node offline |
| `settings_updated` | Alert settings changed |

Clients should refresh authoritative REST state after receiving an event rather than treating the event payload as the complete database record.
