# OfficePulse AI Frontend

Basic Next.js verification dashboard for the MongoDB backend. It reads backend APIs and Socket.IO events only; it never reads simulator state directly and does not calculate kWh or BDT cost itself.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Default backend URL:

```text
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Included Sections

- Live office summary
- Pending ESP32 nodes
- Create room from node
- Assign node to room
- Rooms list
- Nodes list
- Devices list
- Usage timeline
- Office time and BDT/kWh settings
- Alert list
- Basic alert settings editor
