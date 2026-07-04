# Agent Current Task

## START HERE

Read `PROJECT_PLAN.md`, then this file, then `COMPLETED_WORK.md` before doing any work.

## Current Task

Fix the OfficePulse AI Discord bot rejection items: make `!status`, `!room <name>`, and `!usage` the polished primary hackathon commands; route every command reply through Gemini humanization when enabled with high-quality rule-based fallback; fix room lookup for case/space/bracket/fuzzy matches; add `/room` autocomplete; improve backend retry/offline UX; and keep all energy, cost, timing, room total, office total, and alert logic owned by the backend.

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
- [x] Replace the Discord bot placeholder with a Node.js/TypeScript discord.js bot package.
- [x] Add backend-only API client for bot commands.
- [x] Add Google AI Studio/Gemini humanization through official `@google/genai`.
- [x] Default Discord bot Gemini model to `gemini-flash-latest` and document `gemini-3.5-flash` as the stable Flash pin.
- [x] Add slash and prefix command handlers for status, room, usage, alerts, devices, device, nodes, pending, top, waste, visual, health, help, and bot-config.
- [x] Add backend Socket.IO proactive alerts with polling fallback and guild alert-channel config.
- [x] Promote `!status`, `!room <name>`, and `!usage` as polished hackathon-required bot commands.
- [x] Route all Discord command responses through Gemini humanization when enabled, with strong rule-based fallbacks.
- [x] Fix room lookup for exact, case-insensitive, whitespace-insensitive, bracket-stripped, alias, and fuzzy matches.
- [x] Add backend-powered slash autocomplete for room and device options.
- [x] Add backend timeout/retry behavior for bot API reads.
- [x] Add rejection-focused bot tests for required help output, room lookup variants, and prefix parsing.
- [x] Refactor frontend navigation to Overview, Devices, Cost, and Alerts only.
- [x] Move Settings access into the sidebar Live operations card.
- [x] Replace Visualizer navigation with a frosted overview toggle and overlay.
- [x] Rename Usage to Cost and merge room cost breakdowns into the Cost page.
- [x] Move node management into Settings > Device Nodes with friendly terminology.
- [x] Simplify Devices to one persisted Card/List view at a time.
- [x] Simplify Alerts into a frosted notification list with local read/unread state.
- [x] Add alert unread badge, in-app toast, browser notification click routing, and highlight query handling.
- [x] Refactor Settings into top tabs with only active tab content visible.
- [x] Split Settings categories into focused tab components for General, Device Nodes, Rooms, Devices, Alerts, Notifications, Appearance, and Audit.
- [x] Add Discord bot tests and include the bot in the root workspace build.

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

Latest validation for Discord bot implementation:

```bash
npm run build -w discord-bot
npm test -w discord-bot
npm run build
```

Latest validation for Discord bot rejection-fix pass:

```bash
npm run build -w discord-bot
npm test -w discord-bot
npm run commands:register -w discord-bot
```

Manual smoke for Discord bot rejection-fix pass:

```bash
Local command-handler smoke for status, room with "Work Room 1", and usage
Live bot restart; ready as Hepta Dot and connected to backend Socket.IO
```

Latest validation for frontend UI refactor:

```bash
npm run build -w frontend
Invoke-WebRequest http://localhost:3000/
Invoke-WebRequest http://localhost:3000/cost
Invoke-WebRequest http://localhost:3000/devices
Invoke-WebRequest http://localhost:3000/alerts
Invoke-WebRequest "http://localhost:3000/settings?section=device-nodes"
```

Latest validation for Settings tabs refactor:

```bash
npm run build -w frontend
Invoke-WebRequest http://localhost:3000/settings
Invoke-WebRequest "http://localhost:3000/settings?section=device-nodes"
Invoke-WebRequest "http://localhost:3000/settings?tab=rooms"
Invoke-WebRequest "http://localhost:3000/settings?tab=devices"
Invoke-WebRequest "http://localhost:3000/settings?tab=alerts"
Invoke-WebRequest "http://localhost:3000/settings?tab=notifications"
Invoke-WebRequest "http://localhost:3000/settings?tab=appearance"
Invoke-WebRequest "http://localhost:3000/settings?tab=audit"
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
- Discord bot work must use backend APIs only and must not import simulator internals.
- Discord bot Gemini calls must run server-side only, never from frontend/browser.
- Verified from Google AI developer docs on 2026-07-04: `gemini-3.5-flash` is the current stable Flash model, and `gemini-flash-latest` is the latest Flash alias.
- Real ESP32 firmware must preserve the telemetry contract documented in `PROJECT_PLAN.md`.
- The mock backend is intentionally minimal and only supports simulator validation before the real backend exists.
- The simulator visualizer is an internal fake-ESP32 control panel at `http://localhost:5100/`; do not move it into `/frontend`.
- All browser UI built in this project must be fully responsive for all screen sizes by default.
- Do not reintroduce simulator-owned alerts, after-hours warnings, kWh, cost, Discord text, or dashboard-ready summaries.
- Do not send simulator-only measurement profile or custom-power configuration in telemetry.

## Next Task For Future Agent

Continue from the running backend at `http://localhost:4000` and frontend at `http://localhost:3000`, or start them with `npm run dev` from the repo root.
