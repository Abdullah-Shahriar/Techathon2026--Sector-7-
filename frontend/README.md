# OfficePulse AI Frontend

Responsive Next.js operations dashboard for the MongoDB backend. It reads backend APIs and Socket.IO events only; it never reads simulator state directly and does not calculate kWh, BDT cost, alert conditions, or timing itself.

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
- Unassign, reassign, forget, and archive node actions
- Room rename, archive, and restore actions
- Device rename, move, archive, and restore actions
- Normal dashboard view
- Graphical office visualizer
- Rooms, nodes, and devices lists
- Usage charts and timeline
- Office time and BDT/kWh settings
- Alert list
- Alert occurrence display
- Scoped alert settings editor
- Browser notifications for alert occurrence events
- Light, dark, and system theme support
