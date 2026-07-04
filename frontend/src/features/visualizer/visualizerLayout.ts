import type {
  DeviceSummary,
  RoomSummary,
  VisualizerDevicePlacement,
  VisualizerLayout,
  VisualizerRoomPlacement,
  VisualizerRoomTheme
} from "@/features/api/types";

export interface PlanBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FurnitureItem extends PlanBox {
  id: string;
  kind: "desk" | "meeting-table" | "sofa" | "chair" | "plant";
  rotation?: number;
}

const CANVAS_WIDTH = 1200;
const OUTER_WALL = 18;
const ROOM_HEIGHT = 390;
const CORRIDOR_HEIGHT = 132;
const DEVICE_SIZE = 54;
const THEMES: VisualizerRoomTheme[] = ["carpet", "tile", "wood"];

export function generateVisualizerLayout(rooms: RoomSummary[], devices: DeviceSummary[]): VisualizerLayout {
  if (rooms.length === 0) {
    return { canvas: { width: CANVAS_WIDTH, height: 560 }, rooms: [], devices: [] };
  }

  const columns = getColumnCount(rooms.length);
  const rows = Math.ceil(rooms.length / columns);
  const usableWidth = CANVAS_WIDTH - OUTER_WALL * 2;
  const roomWidth = usableWidth / columns;
  const roomPlacements = rooms.map((room, index): VisualizerRoomPlacement => ({
    roomId: room.roomId,
    x: OUTER_WALL + (index % columns) * roomWidth,
    y: OUTER_WALL + Math.floor(index / columns) * ROOM_HEIGHT,
    width: roomWidth,
    height: ROOM_HEIGHT,
    theme: THEMES[index % THEMES.length]
  }));
  const canvas = {
    width: CANVAS_WIDTH,
    height: OUTER_WALL * 2 + rows * ROOM_HEIGHT + CORRIDOR_HEIGHT
  };

  return {
    canvas,
    rooms: roomPlacements,
    devices: placeDevices(rooms, devices, roomPlacements)
  };
}

export function mergeVisualizerLayout(
  saved: VisualizerLayout,
  rooms: RoomSummary[],
  devices: DeviceSummary[]
): VisualizerLayout {
  if (saved.rooms.length === 0) return generateVisualizerLayout(rooms, devices);

  const roomIds = new Set(rooms.map((room) => room.roomId));
  const deviceIds = new Set(devices.map((device) => device.id));
  const keptRooms = saved.rooms.filter((room) => roomIds.has(room.roomId));
  const missingRooms = rooms.filter((room) => !keptRooms.some((placement) => placement.roomId === room.roomId));
  let canvasHeight = Math.max(saved.canvas.height, 560);
  const addedRooms: VisualizerRoomPlacement[] = [];

  if (missingRooms.length > 0) {
    const columns = 3;
    const width = (CANVAS_WIDTH - OUTER_WALL * 2) / columns;
    const startY = Math.max(
      OUTER_WALL,
      ...keptRooms.map((room) => room.y + room.height + OUTER_WALL)
    );
    missingRooms.forEach((room, index) => {
      addedRooms.push({
        roomId: room.roomId,
        x: OUTER_WALL + (index % columns) * width,
        y: startY + Math.floor(index / columns) * ROOM_HEIGHT,
        width,
        height: ROOM_HEIGHT,
        theme: THEMES[(keptRooms.length + index) % THEMES.length]
      });
    });
    canvasHeight = Math.max(
      canvasHeight,
      ...addedRooms.map((room) => room.y + room.height + CORRIDOR_HEIGHT + OUTER_WALL)
    );
  }

  const mergedRooms = [...keptRooms, ...addedRooms];
  const keptDevices = saved.devices.filter((placement) => {
    const device = devices.find((item) => item.id === placement.deviceId);
    return deviceIds.has(placement.deviceId)
      && Boolean(device?.roomId)
      && device?.roomId === placement.roomId
      && mergedRooms.some((room) => room.roomId === placement.roomId);
  });
  const missingDevices = devices.filter((device) =>
    Boolean(device.roomId)
    && mergedRooms.some((room) => room.roomId === device.roomId)
    && !keptDevices.some((placement) => placement.deviceId === device.id)
  );

  return {
    canvas: { width: Math.max(CANVAS_WIDTH, saved.canvas.width), height: canvasHeight },
    rooms: mergedRooms,
    devices: [
      ...keptDevices,
      ...placeDevices(rooms, missingDevices, mergedRooms, keptDevices)
    ]
  };
}

export function getFurniture(room: VisualizerRoomPlacement, roomIndex: number, deviceCount: number): FurnitureItem[] {
  if (deviceCount > 16) return [];
  const x = room.x;
  const y = room.y;
  const w = room.width;
  const h = room.height;

  if (roomIndex === 0) {
    return [
      { id: "sofa", kind: "sofa", x: x + 24, y: y + 112, width: 58, height: 172 },
      { id: "table", kind: "meeting-table", x: x + 112, y: y + 158, width: 74, height: 108 },
      { id: "chair", kind: "chair", x: x + 30, y: y + 302, width: 48, height: 48, rotation: 38 },
      { id: "plant-a", kind: "plant", x: x + 24, y: y + 28, width: 38, height: 38 },
      { id: "plant-b", kind: "plant", x: x + w - 58, y: y + h - 58, width: 36, height: 36 }
    ];
  }

  const deskWidth = Math.min(92, w * 0.25);
  return [
    { id: "desk-a", kind: "desk", x: x + 34, y: y + 110, width: deskWidth, height: 60 },
    { id: "desk-b", kind: "desk", x: x + w - deskWidth - 34, y: y + 110, width: deskWidth, height: 60 },
    { id: "desk-c", kind: "desk", x: x + 34, y: y + 252, width: deskWidth, height: 60 },
    { id: "desk-d", kind: "desk", x: x + w - deskWidth - 34, y: y + 252, width: deskWidth, height: 60 }
  ];
}

export function boxesOverlap(a: PlanBox, b: PlanBox, padding = 0): boolean {
  return a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y;
}

export function pointInsideRoom(x: number, y: number, room: VisualizerRoomPlacement, padding = 24): boolean {
  return x >= room.x + padding
    && y >= room.y + padding
    && x + DEVICE_SIZE <= room.x + room.width - padding
    && y + DEVICE_SIZE <= room.y + room.height - padding;
}

export const deviceSize = DEVICE_SIZE;

function getColumnCount(roomCount: number): number {
  if (roomCount === 1) return 1;
  if (roomCount === 2) return 2;
  if (roomCount <= 6) return 3;
  return Math.min(4, Math.ceil(Math.sqrt(roomCount)));
}

function placeDevices(
  rooms: RoomSummary[],
  devices: DeviceSummary[],
  placements: VisualizerRoomPlacement[],
  occupied: VisualizerDevicePlacement[] = []
): VisualizerDevicePlacement[] {
  const result: VisualizerDevicePlacement[] = [];

  for (const device of devices) {
    if (!device.roomId) continue;
    const room = placements.find((item) => item.roomId === device.roomId);
    const roomIndex = placements.findIndex((item) => item.roomId === device.roomId);
    if (!room) continue;

    const roomDevices = devices.filter((item) => item.roomId === device.roomId);
    const furniture = getFurniture(room, roomIndex, roomDevices.length);
    const taken = [...occupied, ...result]
      .filter((item) => item.roomId === room.roomId)
      .map((item) => ({ x: item.x, y: item.y, width: DEVICE_SIZE, height: DEVICE_SIZE }));
    const position = findOpenPosition(room, furniture, taken, device.type, roomDevices.indexOf(device));
    result.push({ deviceId: device.id, roomId: room.roomId, ...position });
  }

  return result;
}

function findOpenPosition(
  room: VisualizerRoomPlacement,
  furniture: FurnitureItem[],
  taken: PlanBox[],
  type: string,
  order: number
): { x: number; y: number } {
  const points: Array<{ x: number; y: number }> = [];
  const margin = 30;
  const step = 66;
  const roomLabel = {
    x: room.x + room.width / 2 - 78,
    y: room.y + room.height / 2 - 31,
    width: 156,
    height: 62
  };

  for (let y = room.y + margin; y <= room.y + room.height - DEVICE_SIZE - margin; y += step) {
    for (let x = room.x + margin; x <= room.x + room.width - DEVICE_SIZE - margin; x += step) {
      points.push({ x, y });
    }
  }

  points.sort((a, b) => scorePoint(a, room, type, order) - scorePoint(b, room, type, order));
  return points.find((point) => {
    const box = { ...point, width: DEVICE_SIZE, height: DEVICE_SIZE };
    return !boxesOverlap(box, roomLabel, 8)
      && !furniture.some((item) => boxesOverlap(box, item, 8))
      && !taken.some((item) => boxesOverlap(box, item, 7));
  }) ?? {
    x: room.x + margin + (order % 4) * step,
    y: room.y + margin + Math.floor(order / 4) * step
  };
}

function scorePoint(
  point: { x: number; y: number },
  room: VisualizerRoomPlacement,
  type: string,
  order: number
): number {
  const centerX = room.x + room.width / 2 - DEVICE_SIZE / 2;
  const centerY = room.y + room.height / 2 - DEVICE_SIZE / 2;
  const centerDistance = Math.abs(point.x - centerX) + Math.abs(point.y - centerY);
  const edgeDistance = Math.min(
    point.x - room.x,
    room.x + room.width - point.x,
    point.y - room.y,
    room.y + room.height - point.y
  );

  if (type === "fan") return centerDistance + order * 0.01;
  if (type === "light") return edgeDistance * 3 + centerDistance * 0.1 + order * 0.01;
  return centerDistance * 0.65 + order * 0.01;
}
