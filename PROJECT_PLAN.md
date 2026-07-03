# OfficePulse AI Project Plan

## START HERE

Future agents must read these files in this order before doing any work:

1. `PROJECT_PLAN.md`
2. `AGENT_CURRENT_TASK.md`
3. `COMPLETED_WORK.md`

This repository is for OfficePulse AI, an AI + IoT office electricity monitoring system. Keep the architecture modular: simulated or real room nodes send telemetry to the backend, and all user-facing clients read from the backend only.

## Project Overview

OfficePulse AI monitors office electricity usage across three rooms and fifteen fixed devices. The system will combine simulated or physical IoT room nodes, a backend IoT API, a real-time web dashboard, a Discord bot, and documentation for diagrams and hardware schematics.

Core architecture:

```text
Device Simulator / ESP32 room nodes -> Backend IoT API -> Web Dashboard + Discord Bot
```

The simulator is a replaceable stand-in for real ESP32 room nodes. It must behave like physical room devices by sending device-level telemetry to the backend. The dashboard and Discord bot must never read simulator state directly.

The simulator also serves an internal fake-ESP32 visualizer at `http://localhost:5100/`. This browser UI is for inspecting and controlling simulator room-node data only. It is not the future boss-facing dashboard, and it must stay inside `simulator/`.

## Hackathon Requirements Summary

- Build an AI + IoT office electricity monitoring system.
- Include a real-time web dashboard.
- Include a Discord bot.
- Provide simulated device data.
- Provide a system diagram.
- Provide a hardware or electrical schematic using Wokwi, Tinkercad, or equivalent documentation.

## Fixed Device Count

The official fixed device count is:

- 3 rooms
- 5 devices per room
- 15 devices total

Rooms and devices:

| Room ID | Room Name | Devices |
| --- | --- | --- |
| `drawing` | Drawing Room | Fan 1, Fan 2, Light 1, Light 2, Light 3 |
| `work1` | Work Room 1 | Fan 1, Fan 2, Light 1, Light 2, Light 3 |
| `work2` | Work Room 2 | Fan 1, Fan 2, Light 1, Light 2, Light 3 |

Power assumptions:

| Device | ON Power | OFF Power |
| --- | ---: | ---: |
| Fan | 60W | 0W |
| Light | 15W | 0W |

Room maximum: 165W.
Office maximum: 495W.

## Architecture

Repository modules:

- `simulator/`: TypeScript Node.js simulator for fake ESP32 room nodes. Implemented first.
- `backend/`: Future backend IoT API. Placeholder only for now.
- `frontend/`: Future web dashboard. Placeholder only for now.
- `discord-bot/`: Future Discord bot. Placeholder only for now.
- `docs/`: Future diagrams, schematics, and demo documentation. Placeholder only for now.

## Simulator Role

The simulator represents three ESP32-style room nodes:

| Node ID | Room ID | Room Name |
| --- | --- | --- |
| `room-node-drawing` | `drawing` | Drawing Room |
| `room-node-work1` | `work1` | Work Room 1 |
| `room-node-work2` | `work2` | Work Room 2 |

Device IDs use this format:

```text
{roomId}-{type}-{number}
```

Examples:

- `drawing-fan-1`
- `drawing-light-3`
- `work1-fan-2`
- `work2-light-1`

Real ESP32 nodes should be able to replace the simulator later by sending the same room-node telemetry payload to the same backend endpoint.

The simulator defaults to Manual Mode. Manual device, wattage, and measurement-profile changes send telemetry immediately for the affected room node. Auto Mode is optional and can make physical state changes, but it must be explicitly enabled. Heartbeat telemetry continues in both modes.

## Telemetry Contract

Room nodes send telemetry with:

- Method: `POST`
- URL: `{BACKEND_URL}/api/iot/telemetry`
- Headers:
  - `Content-Type: application/json`
  - `x-device-api-key: {DEVICE_API_KEY}`

Each fake room node sends only its own five devices. The backend combines room-node telemetry into office state and calculates official timestamps, on durations, room totals, total office power, alerts, kWh, costs, dashboard state, and Discord bot answers.

Payload shape:

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

Allowed `eventType` values are `boot`, `heartbeat`, `state_change`, and `manual_sync`.

The future backend must accept this exact contract from either the simulator or physical ESP32 hardware. The simulator must not send any device clock, simulator timing, timestamp, source, room identity, rated wattage, simulator profile, root sensor, alert, duration, energy, cost, or GPIO/raw pin details in telemetry. The backend maps `nodeId` to a room, stores the device catalog and rated wattage, stamps received telemetry with backend time, and owns official timestamps, durations, history, summaries, alert detection, kWh, costs, dashboard state, and Discord bot answers.

## Folder Structure

```text
.
├── PROJECT_PLAN.md
├── AGENT_CURRENT_TASK.md
├── COMPLETED_WORK.md
├── simulator/
├── backend/
├── frontend/
├── discord-bot/
└── docs/
```

## Future Backend Plan

The backend will become the single source of truth. It should:

- Receive `POST /api/iot/telemetry` from simulator or ESP32 room nodes.
- Validate `x-device-api-key`.
- Store current room and device state.
- Expose APIs for dashboard and Discord bot.
- Broadcast updates through WebSocket or Server-Sent Events.
- Persist telemetry history for analytics and AI insights.

Do not let frontend or Discord bot read simulator state directly.

## Future Frontend Plan

The frontend dashboard will:

- Fetch current state from backend APIs.
- Subscribe to backend real-time updates.
- Show room-level and office-level power usage.
- Show per-device status, current watts, and on-time.
- Surface after-hours or high-usage alerts from backend data.

Do not move the simulator visualizer into `/frontend`. `/frontend` is reserved for the future boss-facing dashboard.

## Future Discord Bot Plan

The Discord bot will:

- Read from backend APIs only.
- Report room and office power status.
- Trigger backend-approved commands if control features are added.
- Never import or query simulator internals.

## Future Wokwi/Tinkercad Schematic Plan

The `docs/` module will later include:

- System architecture diagram.
- Hardware or electrical schematic.
- Wokwi or Tinkercad project link or screenshots.
- Explanation of how real ESP32 room nodes map to simulator room nodes.

## Engineering Rules

- Keep simulator, backend, frontend, bot, and docs separate.
- Implement one module at a time.
- Treat simulator telemetry as external device input, not shared app state.
- Preserve the fixed 3 room x 5 device model unless project requirements change.
- Keep backend as the future single source of truth.
- Simulator visualizer is not terminal-only; it has a polished, fully responsive browser UI at `http://localhost:5100/`.
- All browser UI built in this project must be fully responsive for all screen sizes by default.
- Add tests for contracts, calculations, and state transitions.
- Update `AGENT_CURRENT_TASK.md` before starting work, after major milestones, and before final response.
- Append to `COMPLETED_WORK.md`; do not erase useful history.
