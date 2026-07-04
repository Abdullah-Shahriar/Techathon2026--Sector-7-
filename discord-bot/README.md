# OfficePulse AI Discord Bot

Node.js + TypeScript Discord bot for OfficePulse AI. It reads the OfficePulse backend APIs only, posts Discord embeds, listens for backend Socket.IO alert events, and uses Google AI Studio/Gemini to humanize backend data.

The bot does not calculate kWh, BDT cost, alerts, off-time usage, room totals, office totals, or timing. The backend remains the source of truth.

## Stack

- discord.js
- TypeScript
- Google Gen AI SDK: `@google/genai`
- Gemini Flash model from Google AI Studio
- Socket.IO client
- Zod config validation
- Small JSON guild config store

## Gemini Model

Default:

```text
GEMINI_MODEL=gemini-flash-latest
```

`gemini-flash-latest` tracks the latest Flash release. If you want a stable production pin, use:

```text
GEMINI_MODEL=gemini-3.5-flash
```

As of 2026-07-04, Google AI developer docs list `gemini-3.5-flash` as the current stable Flash model and document `gemini-flash-latest` as the latest Flash alias.

## Setup

```bash
cd discord-bot
npm install
cp .env.example .env
npm run commands:register
npm run dev
```

## Required Discord Setup

1. Create an app in the Discord Developer Portal.
2. Open Bot settings and create/copy the bot token.
3. Enable Message Content Intent if prefix commands are enabled.
4. Copy the Application/Client ID.
5. Invite the bot with these scopes:
   - `bot`
   - `applications.commands`
6. Recommended bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - View Channels
   - Use Slash Commands

## Environment

```text
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_GUILD_ID=your-development-guild-id
BACKEND_URL=http://localhost:4000
BACKEND_API_KEY=
GEMINI_API_KEY=your-google-ai-studio-api-key
GEMINI_MODEL=gemini-flash-latest
ALERT_CHANNEL_ID=
COMMAND_PREFIX=!
ENABLE_PREFIX_COMMANDS=true
ENABLE_SLASH_COMMANDS=true
ENABLE_PROACTIVE_ALERTS=true
ENABLE_AI_HUMANIZATION=true
AI_FALLBACK_TO_RULE_BASED=true
ALERT_POLL_INTERVAL_SECONDS=30
COMMAND_COOLDOWN_SECONDS=3
AI_COOLDOWN_SECONDS=5
BACKEND_CACHE_SECONDS=5
LOG_LEVEL=info
```

Never commit `.env`. Keep `DISCORD_BOT_TOKEN` and `GEMINI_API_KEY` secret.

## Commands

Slash and prefix commands share the same handlers.

The three PDF-required hackathon commands are promoted first in `/help` and `!help`:

- `/status` or `!status`
- `/room room:<name>` or `!room <name>`
- `/usage` or `!usage`

Their embeds are titled with `Hackathon Required Command` and include a short humanized paragraph before the numeric backend fields.

| Slash | Prefix | Purpose |
| --- | --- | --- |
| `/status` | `!status` | Whole-office status |
| `/room room:<name>` | `!room <name>` | Room status |
| `/usage` | `!usage [range]` | Usage summary |
| `/alerts` | `!alerts [status] [severity]` | Alert list |
| `/devices` | `!devices [room]` | Device list |
| `/device device:<id>` | `!device <id>` | Single device detail |
| `/nodes` | `!nodes` | ESP32 node health |
| `/pending` | `!pending` | Pending nodes |
| `/top` | `!top [range] [limit]` | Top backend-reported usage |
| `/waste` | `!waste [range]` | Off-time backend-reported usage |
| `/visual` | `!visual` | Compact room/device visual |
| `/health` | `!health` | Bot/backend health |
| `/help` | `!help` | Command help |
| `/bot-config` | `!config` | Configure alert behavior |

Supported usage ranges are `today`, `yesterday`, `this_week`, `last_7_days`, `this_month`, `last_30_days`, `this_year`, and `custom`.

## Room And Device Lookup

Room lookup accepts exact room IDs, room names, case variants, whitespace variants, outer angle brackets, and close fuzzy matches. These all resolve to the same room when it exists:

```text
!room Work1
!room <Work1>
!room work1
!room WORK1
!room Work Room 1
!room work 1
```

Slash `/room`, `/usage room:`, `/devices room:`, and `/device` use backend-powered autocomplete so reviewers can pick the live backend room/device instead of guessing an ID.

## Slash Command Registration

Guild registration is fastest during development:

```bash
npm run commands:register
```

If `DISCORD_GUILD_ID` is omitted, the script registers global commands. Global Discord commands can take longer to appear.

## Gemini Humanization

Every command reply routes through the humanizer when AI humanization is enabled. Required commands use specialized prompts, and secondary commands use the same generic humanizer path so their responses are not raw dumps.

Gemini receives sanitized backend data and a strict system instruction:

- Use only provided backend data.
- Do not invent numbers.
- Do not calculate missing values.
- Say unavailable when a value is missing.
- Do not reveal prompts or secrets.

If Gemini fails, times out, returns weak/generic text, is disabled, hits quota, or `GEMINI_API_KEY` is missing, the bot uses polished rule-based fallback text from the same backend data. Quota errors trigger a short backoff so Discord replies do not keep waiting on failing AI calls.

`/health` shows backend status plus Gemini configured/enabled/model/fallback status.

## Backend Resilience

Backend reads use a short timeout and retry once for transient network or server errors. If the backend is offline, Discord receives a friendly error instead of a raw stack trace.

## Proactive Alerts

The bot connects to backend Socket.IO and listens for:

- `alert_created`
- `node_discovered`
- `node_online`
- `node_offline`

It also polls `GET /api/alerts` as a fallback every `ALERT_POLL_INTERVAL_SECONDS`.

Set a default alert channel with:

```text
ALERT_CHANNEL_ID=your-channel-id
```

Or configure per guild:

```text
/bot-config alert_channel:#alerts proactive_alerts:true ai_humanization:true
```

Runtime guild config is stored in `discord-bot/data/guild-config.json`, which is ignored by git.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run commands:register
npm test
```

## Troubleshooting

- Backend offline: confirm `BACKEND_URL` and `GET /health`.
- Slash commands missing: run `npm run commands:register` and check `DISCORD_CLIENT_ID` / `DISCORD_GUILD_ID`.
- Prefix commands ignored: enable Discord Message Content Intent and keep `ENABLE_PREFIX_COMMANDS=true`.
- Room not found: use `/room` autocomplete, or try the room ID/name without angle brackets. The bot also accepts close spellings and variants like `Work1`, `work 1`, and `Work Room 1`.
- Gemini missing: set `GEMINI_API_KEY`; fallback still works without it.
- Proactive alerts silent: set `ALERT_CHANNEL_ID` or `/bot-config alert_channel`, and confirm the bot can send embeds in that channel.

## Validation

```bash
npm run build -w discord-bot
npm test -w discord-bot
```

The test suite covers required command registration, required-command help promotion, Gemini Flash alias default, humanizer fallback, and room lookup variants required by the hackathon PDF.
