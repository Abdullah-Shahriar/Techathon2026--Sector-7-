# OfficePulse AI Backend

Express + TypeScript backend for OfficePulse AI. The backend receives ESP32/simulator telemetry, stores it in MongoDB, calculates latest state, usage, BDT cost, alerts, and broadcasts Socket.IO updates.

## Stack

- MongoDB
- Mongoose
- Express
- Zod
- Socket.IO
- Helmet, CORS, rate limiting

No Prisma and no SQLite are used.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run seed
npm run dev
```

MongoDB must be running at `mongodb://127.0.0.1:27017/officepulse` unless `MONGODB_URI` is changed.

## Environment

```text
MONGODB_URI=mongodb://127.0.0.1:27017/officepulse
PORT=4000
DEVICE_API_KEY=dev-device-key
CORS_ORIGIN=http://localhost:3000
DEFAULT_TIMEZONE=Asia/Dhaka
DEFAULT_BDT_PER_KWH=12
DEFAULT_OFFICE_START_TIME=09:00
DEFAULT_OFFICE_END_TIME=18:00
DEFAULT_ALERT_REPEAT_MINUTES=120
HEARTBEAT_TIMEOUT_SECONDS=20
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run seed
```

## Collections

- `rooms`
- `esp32_nodes`
- `devices`
- `latest_device_states`
- `telemetry_events`
- `usage_intervals`
- `alerts`
- `alert_settings`
- `settings`
- `node_sequence_logs`
- `node_discovery_events`

## Telemetry Example

```bash
curl -X POST http://localhost:4000/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -H "x-device-api-key: dev-device-key" \
  -d "{\"schemaVersion\":\"1.0\",\"nodeId\":\"room-node-work1\",\"sequence\":1,\"eventType\":\"state_change\",\"changedDeviceIds\":[\"work1-fan-1\"],\"devices\":[{\"id\":\"work1-fan-1\",\"status\":\"on\",\"measurements\":{\"voltageVolts\":220,\"currentAmps\":0.273,\"powerWatts\":60}}]}"
```

## API List

- `GET /health`
- `POST /api/iot/telemetry`
- `GET /api/state`
- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/:id`
- `PATCH /api/rooms/:id`
- `DELETE /api/rooms/:id`
- `GET /api/devices`
- `GET /api/devices/:id`
- `PATCH /api/devices/:id`
- `GET /api/nodes`
- `GET /api/nodes/pending`
- `POST /api/nodes/:nodeId/assign-room`
- `POST /api/nodes/:nodeId/create-room`
- `POST /api/nodes/:nodeId/ignore`
- `GET /api/usage/summary`
- `GET /api/usage/rooms`
- `GET /api/usage/devices`
- `GET /api/usage/timeline`
- `GET /api/alerts`
- `GET /api/alerts/settings`
- `PATCH /api/alerts/:id/acknowledge`
- `PATCH /api/alerts/:id/resolve`
- `PATCH /api/alerts/settings`
- `GET /api/settings`
- `PATCH /api/settings`
