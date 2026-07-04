# Agent Current Task

## START HERE

Read `PROJECT_PLAN.md`, then this file, then `COMPLETED_WORK.md` before doing any work.

## Current Task

Complete the OfficePulse AI backend/dashboard pass: fix remaining MongoDB/Mongoose backend correctness gaps, add safe room/node/device management, audit/history support, alert occurrence visibility, richer usage queries, and replace the basic Next.js verification dashboard with a professional responsive dashboard plus graphical office visualizer. Backend stack remains MongoDB, Mongoose, TypeScript, Express, Zod, and Socket.IO. Do not use Prisma, SQLite, Prisma migrations, `prisma/schema.prisma`, or prisma scripts.

## Current Assumptions

- Runtime target is Node.js 20+.
- Simulator language is TypeScript.
- npm is the package manager.
- Backend database is MongoDB at `mongodb://127.0.0.1:27017/officepulse` by default.
- Backend uses Mongoose models for all database collections.
- The simulator represents three room nodes and exactly fifteen devices.
- The simulator is a fake physical device layer, not the backend.
- Manual Mode is default and must not randomly change devices.
- Backend maps `nodeId` to rooms and remains responsible for official timestamps, durations, room/office summaries, alerts, kWh, costs, dashboard state, and Discord bot answers.
- Backend default URL is `http://localhost:4000`.
- Control API default port is `5100`.
- Backend API default port is `4000`.
- Frontend default port is `3000`.
- Timezone is `Asia/Dhaka`.

## Current Implementation Checklist

- [x] Create root context files.
- [x] Create placeholder folders and README files.
- [x] Implement simulator package structure.
- [x] Implement fixed room and device catalog.
- [x] Implement simulator state store and power calculations.
- [x] Implement telemetry payload builder and client.
- [x] Implement auto simulation behavior.
- [x] Implement manual control API.
- [x] Implement mock backend receiver.
- [x] Write tests.
- [x] Run validation commands.
- [x] Add simulator visualizer static files under `simulator/public/`.
- [x] Serve `GET /`, `/styles.css`, and `/app.js` from `simulator/src/controlServer.ts`.
- [x] Add latest telemetry/send status data for the UI.
- [x] Validate controls, responsiveness, typecheck, and tests.
- [x] Correct simulator architecture to Manual Mode default.
- [x] Add optional Auto Mode controls.
- [x] Add boot, heartbeat, state_change, and manual_sync telemetry event types.
- [x] Add per-device wattage and measurement-profile controls.
- [x] Remove simulator-owned active alerts and after-hours logic from the UI.
- [x] Show latest telemetry for all three room nodes at once.
- [x] Replace telemetry payload with final ESP32-like contract.
- [x] Replace per-device Toggle/ON/OFF buttons with one physical-style switch.
- [x] Add final node send endpoints and UI controls.
- [x] Update tests for final payload exclusions and measurement fields.
- [x] Update this handover file and append `COMPLETED_WORK.md`.
- [x] Remove `ratedPowerWatts` from outgoing device telemetry.
- [x] Update telemetry tests and docs for the narrower device payload.
- [x] Re-run typecheck, tests, and responsive UI smoke validation.
- [x] Remove simulator-owned timing from outgoing telemetry types and builders.
- [x] Remove simulator-owned timing from simulator payload previews.
- [x] Remove simulator-owned timing from docs and update timing ownership notes.
- [x] Point simulator defaults and `.env.example` at the new backend URL and device API key convention.
- [x] Confirm telemetry client sends `POST /api/iot/telemetry` with `x-device-api-key`.
- [x] Confirm one payload is built and sent per ESP32 room node.
- [x] Confirm outgoing telemetry omits simulator-only fields such as timing, room identity, source labels, rated wattage, and measurement-profile controls.
- [x] Replace backend database plan with MongoDB/Mongoose.
- [x] Add backend package, Mongoose models, config, API routes, and Socket.IO server.
- [x] Add telemetry ingestion with strict Zod payload validation.
- [x] Add dynamic node, room, and device discovery APIs.
- [x] Add backend-owned latest state, usage interval, cost, settings, and alert logic.
- [x] Add basic responsive Next.js frontend that only calls backend APIs.
- [x] Remove leftover `room-node-smoke` validation artifact from the local dev MongoDB.
- [x] Reconcile local dev MongoDB so each real simulator node maps to its own correct room.
- [x] Prevent assigning more than one active/offline ESP32 node to the same room.
- [x] Change the top dashboard cost metric from projected monthly estimate to actual month-to-date cost.
- [x] Improve pending-node room-name suggestions for the three simulator room nodes.
- [x] Fix duplicate/old telemetry sequence handling so stale payloads cannot mutate latest state or usage.
- [x] Resolve discovery alerts when nodes/devices are handled.
- [x] Add safe room, node, and device management APIs with audit/history records.
- [x] Add explicit alert occurrence collection/API while preserving active alert summaries.
- [x] Expand usage range/grouping support to the requested names.
- [x] Refactor frontend into reusable API, realtime, notification, dashboard, management, usage, alert, and visualizer modules.
- [x] Add normal dashboard view, graphical office visualizer, browser notifications, and responsive light/dark/system theme support.
- [x] Run requested install/build/test/audit validation and update this handover plus completed work.

## Files Being Created

- `PROJECT_PLAN.md`
- `AGENT_CURRENT_TASK.md`
- `COMPLETED_WORK.md`
- `backend/README.md`
- `frontend/README.md`
- `discord-bot/README.md`
- `docs/README.md`
- `simulator/package.json`
- `simulator/tsconfig.json`
- `simulator/.env.example`
- `simulator/README.md`
- `simulator/src/*`
- `simulator/tests/*`
- `simulator/public/index.html`
- `simulator/public/styles.css`
- `simulator/public/app.js`

## Validation Commands

Completed from `simulator/`:

```bash
npm install
npm run typecheck
npm test
node --check public/app.js
```

Latest validation for final payload contract:

```bash
npm run typecheck
node --check public/app.js
npm test
```

Latest validation for telemetry without `ratedPowerWatts`:

```bash
npm run typecheck
node --check public/app.js
npm test
npm run dry -- --no-auto-start
```

Latest validation for new backend compatibility:

```bash
npm install
npm run build
npm run dry -- --no-auto-start
```

Latest validation for MongoDB backend and Next.js frontend:

```bash
npm install
npm run build -w backend
npm run build -w frontend
npm run build
npm run seed -w backend
```

Latest validation for duplicate-node guard and dashboard cost display:

```bash
npm run build -w backend
npm test -w backend
npm run build -w frontend
```

Runtime smoke check completed:

```bash
npm run dry
Invoke-RestMethod -Uri 'http://localhost:5100/health'
npx --yes --package @playwright/cli playwright-cli open http://localhost:5100/
```

## Known Risks

- Live telemetry expects the backend at `http://localhost:4000` by default and should use `DEVICE_API_KEY=dev-device-key` unless overridden in `.env`.
- MongoDB must be running locally for `npm run dev -w backend`, `npm run seed -w backend`, and live API smoke tests.
- Local `.env` files have been created for `backend/`, `frontend/`, and `simulator/`.
- Keep frontend and simulator backend URLs as `http://localhost:4000`; a separate Python process currently owns IPv4 `0.0.0.0:4000`, so `http://127.0.0.1:4000` can hang.
- Use the isolated `officepulse_test` database for backend tests and avoid inserting validation-only nodes into the default `officepulse` dev database.
- Future dashboard and bot work must use backend APIs only.
- Real ESP32 firmware must preserve the telemetry contract documented in `PROJECT_PLAN.md`.
- The mock backend is intentionally minimal and only supports simulator validation before the real backend exists.
- The simulator visualizer is an internal fake-ESP32 control panel at `http://localhost:5100/`; do not move it into `/frontend`.
- All browser UI built in this project must be fully responsive for all screen sizes by default.
- Do not reintroduce simulator-owned alerts, after-hours warnings, kWh, cost, Discord text, or dashboard-ready summaries.
- Do not send simulator-only measurement profile or custom-power configuration in telemetry.

## Next Task For Future Agent

Continue from the running backend at `http://localhost:4000` and frontend at `http://localhost:3000`, or start them with `npm run dev` from the repo root.
