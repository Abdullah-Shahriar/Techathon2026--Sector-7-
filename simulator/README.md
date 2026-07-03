# OfficePulse AI Simulator

The simulator behaves like three fake ESP32 room nodes for the OfficePulse AI project. It owns no dashboard state and does not act as the backend. Its job is to send realistic room telemetry to the backend endpoint that real ESP32 devices will use later.

## Why This Module Is Separate

The project architecture is:

```text
Device Simulator / ESP32 room nodes -> Backend IoT API -> Web Dashboard + Discord Bot
```

The simulator is replaceable hardware input. The future dashboard and Discord bot must read backend APIs only, never simulator internals.

## Fixed Office Model

The simulator always uses:

- 3 rooms
- 5 devices per room
- 15 devices total

Rooms:

| Room ID | Room Name | Node ID |
| --- | --- | --- |
| `drawing` | Drawing Room | `room-node-drawing` |
| `work1` | Work Room 1 | `room-node-work1` |
| `work2` | Work Room 2 | `room-node-work2` |

Each room has:

- 2 fans at 60W each
- 3 lights at 15W each
- Maximum room load of 165W

Office maximum load is 495W.

## Setup

```bash
cd simulator
npm install
cp .env.example .env
```

Node.js 20 or newer is required.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:4000` | Backend base URL |
| `IOT_TELEMETRY_PATH` | `/api/iot/telemetry` | Telemetry endpoint path |
| `DEVICE_API_KEY` | `dev-device-key` | Device API key sent in `x-device-api-key` |
| `SIMULATOR_CONTROL_PORT` | `5100` | Manual control API port |
| `TICK_INTERVAL_MS` | `3000` | Optional Auto Mode physical-change tick interval |
| `HEARTBEAT_INTERVAL_MS` | `5000` | Room-node heartbeat telemetry interval |
| `AUTO_START` | `true` | Legacy flag; simulator now starts in Manual Mode and sends boot/heartbeat telemetry |
| `DRY_RUN` | `false` | Log payloads instead of POSTing them |
| `TIMEZONE` | `Asia/Dhaka` | UI/runtime timezone for simulator state only; not sent in telemetry |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |

## Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm test
npm run dry
npm run mock-backend
```

Use `npm run dry` to run without a backend. It starts the control API and logs telemetry payloads instead of sending HTTP requests.

## Browser Visualizer

The simulator visualizer is not terminal-only. It has a polished, fully responsive browser UI at:

```text
http://localhost:5100/
```

Run it with:

```bash
cd simulator
npm run dry
```

Then open `http://localhost:5100/`.

The visualizer is an internal fake-ESP32 control panel. It lives in `simulator/public/`, is served by `simulator/src/controlServer.ts`, and calls the simulator control API. It is not the future boss-facing dashboard, and it must not be moved to `/frontend`.

The page shows:

- Manual Mode / Auto Mode status.
- Backend target URL and telemetry endpoint.
- Backend connection and latest send result.
- Last telemetry sent time, auto tick interval, and heartbeat interval.
- Dry-run mode status.
- Raw current-power previews from simulated physical devices.
- All 15 devices grouped by room.
- ON/OFF visual states with glowing lights and spinning fan indicators.
- Manual controls for devices, rooms, wattage, measurement profiles, optional Auto Mode, and telemetry sending.
- Latest telemetry payload JSON for all three room nodes at once.
- Recent simulator events and errors.

All browser UI built in this project must be fully responsive for all screen sizes by default.

## Mock Backend Usage

Terminal 1:

```bash
cd simulator
npm run mock-backend
```

Terminal 2:

```bash
cd simulator
npm run dev
```

The mock backend listens on the port from `BACKEND_URL`, defaulting to `4000`, and receives `POST /api/iot/telemetry`.

Mock backend helper routes:

- `GET http://localhost:4000/health`
- `GET http://localhost:4000/telemetry`

## Telemetry Contract

The simulator sends:

- Method: `POST`
- URL: `{BACKEND_URL}/api/iot/telemetry`
- Headers:
  - `Content-Type: application/json`
  - `x-device-api-key: {DEVICE_API_KEY}`

Example payload:

```json
{
  "schemaVersion": "1.0",
  "nodeId": "room-node-work1",
  "sequence": 42,
  "eventType": "state_change",
  "changedDeviceIds": ["work1-fan-1"],
  "devices": [
    {
      "id": "work1-fan-1",
      "status": "on",
      "measurements": {
        "voltageVolts": 220,
        "currentAmps": 0.273,
        "powerWatts": 60
      }
    }
  ]
}
```

Real ESP32 firmware should send this same shape later. The backend cannot need to know whether the sender is the simulator or a real ESP32. The backend maps `nodeId` to room identity, owns the device catalog and rated wattage, stamps received telemetry with backend time, and is responsible for official received time, state-change timing, on duration, history, room totals, office totals, alerts, kWh, cost, dashboard state, and Discord bot answers.

Allowed telemetry event types:

- `boot`
- `heartbeat`
- `state_change`
- `manual_sync`

Telemetry deliberately does not include simulator source labels, device-side timing, timezone, room identity, rated wattage, simulator profile/custom power settings, root-level sensors, alerts, GPIO pin details, duration, kWh, or cost. Rated wattage, measurement profile, and custom power settings exist only inside the simulator to generate fake physical measurements.

## Manual And Auto Modes

Manual Mode is the default. In Manual Mode, device switch changes, wattage edits, measurement-profile edits, and room all ON/OFF changes happen only when the user clicks controls. Each physical change sends telemetry immediately for that affected room node. Manual Mode never randomly changes devices.

Auto Mode is optional. When enabled, it can make neutral simulated physical state changes and sends telemetry immediately for each affected room node. Auto Mode can be paused and resumed. Heartbeat telemetry continues in both modes.

On startup, the simulator sends a boot snapshot for all three room nodes. Heartbeat telemetry sends all three room-node snapshots every `HEARTBEAT_INTERVAL_MS`.

## Manual Control API

The control API defaults to `http://localhost:5100`.

| Method | Path | Action |
| --- | --- | --- |
| `GET` | `/` | Simulator browser visualizer |
| `GET` | `/health` | Simulator health |
| `GET` | `/state` | Current simulator snapshot, runtime metadata, telemetry status, and event log |
| `GET` | `/telemetry/latest` | Latest telemetry status for all room nodes |
| `PATCH` | `/devices/:deviceId/state` | Set one device to `on`, `off`, or `toggle` |
| `PATCH` | `/devices/:deviceId/rated-wattage` | Edit or reset rated wattage |
| `PATCH` | `/devices/:deviceId/measurement-profile` | Set `rated`, `low`, `max`, `variable`, or `custom` measurement profile |
| `PATCH` | `/devices/:deviceId/custom-power` | Edit or clear custom power |
| `POST` | `/nodes/:nodeId/all-on` | Turn one ESP32 room node fully on |
| `POST` | `/nodes/:nodeId/all-off` | Turn one ESP32 room node fully off |
| `POST` | `/nodes/:nodeId/send-now` | Send one ESP32 room-node payload immediately |
| `POST` | `/simulation/mode/manual` | Enable Manual Mode |
| `POST` | `/simulation/mode/auto` | Enable Auto Mode |
| `POST` | `/simulation/pause` | Pause Auto Mode physical changes |
| `POST` | `/simulation/resume` | Resume Auto Mode physical changes |
| `POST` | `/simulation/reset` | Reset state to all off |
| `POST` | `/telemetry/send-all-now` | Send all three ESP32 room-node payloads immediately |

Examples:

```bash
curl http://localhost:5100/state
curl -X PATCH http://localhost:5100/devices/work1-fan-1/state -H "Content-Type: application/json" -d "{\"status\":\"on\"}"
curl -X PATCH http://localhost:5100/devices/work1-fan-1/rated-wattage -H "Content-Type: application/json" -d "{\"ratedPowerWatts\":120}"
curl -X PATCH http://localhost:5100/devices/work1-fan-1/custom-power -H "Content-Type: application/json" -d "{\"customPowerWatts\":80}"
curl -X PATCH http://localhost:5100/devices/work1-fan-1/measurement-profile -H "Content-Type: application/json" -d "{\"measurementProfile\":\"custom\"}"
curl -X POST http://localhost:5100/nodes/room-node-work1/send-now
curl -X POST http://localhost:5100/telemetry/send-all-now
```

## State Rules

- Exactly 15 devices exist.
- Each room has exactly 2 fans and 3 lights.
- Fan ON power is 60W.
- Light ON power is 15W.
- OFF power is 0W.
- Default room power is 165W when all default-rated devices are on.
- Default office power is 495W when all default-rated devices are on.
- Fan rated wattage can be edited from 10W to 150W.
- Light rated wattage can be edited from 1W to 100W.
- Measurement profiles are `rated`, `low`, `max`, `variable`, and `custom`.
- OFF devices always send measurement values of `voltageVolts: 0`, `currentAmps: 0`, and `powerWatts: 0` regardless of rated wattage or measurement profile.
- ON devices usually send `voltageVolts: 220`, with `currentAmps` calculated from `powerWatts / voltageVolts` rounded to 3 decimals.
- `lastChanged` changes only when `status` changes.
- `onSince` is set when a device turns on.
- `onSince` becomes `null` when a device turns off.
