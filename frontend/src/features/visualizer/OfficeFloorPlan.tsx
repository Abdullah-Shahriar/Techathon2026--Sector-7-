"use client";

import {
  AlertTriangle,
  Armchair,
  DoorOpen,
  Fan,
  Lightbulb,
  Minus,
  Monitor,
  Move,
  Pencil,
  PlugZap,
  Plus,
  RotateCcw,
  Save,
  TreePine,
  Wifi,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/features/api/client";
import type {
  AlertSummary,
  DeviceSummary,
  NodeSummary,
  RoomSummary,
  VisualizerLayout,
  VisualizerRoomPlacement
} from "@/features/api/types";
import { formatBdt, formatWatts } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  boxesOverlap,
  deviceSize,
  generateVisualizerLayout,
  getFurniture,
  mergeVisualizerLayout,
  pointInsideRoom,
  type FurnitureItem
} from "./visualizerLayout";

type DragState = {
  kind: "room" | "device";
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  snapshot: VisualizerLayout;
};

export function OfficeFloorPlan({
  rooms,
  devices,
  nodes,
  alerts
}: {
  rooms: RoomSummary[];
  devices: DeviceSummary[];
  nodes: NodeSummary[];
  alerts: AlertSummary[];
}) {
  const [layout, setLayout] = useState<VisualizerLayout | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<VisualizerLayout | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dataFingerprint = useMemo(
    () => `${rooms.map((room) => room.roomId).join("|")}::${devices.map((device) => `${device.id}:${device.roomId ?? ""}`).join("|")}`,
    [rooms, devices]
  );

  useEffect(() => {
    let active = true;
    void api.visualizerLayout()
      .then((saved) => {
        if (!active) return;
        const merged = mergeVisualizerLayout(saved, rooms, devices);
        layoutRef.current = merged;
        setLayout(merged);
        setStorageError("");
      })
      .catch(() => {
        if (!active) return;
        const generated = generateVisualizerLayout(rooms, devices);
        layoutRef.current = generated;
        setLayout(generated);
        setStorageError("Layout storage is unavailable. Editing still works, but changes cannot be saved yet.");
      });
    return () => {
      active = false;
    };
    // The merge effect below handles devices discovered after the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!layoutRef.current) return;
    const merged = mergeVisualizerLayout(layoutRef.current, rooms, devices);
    layoutRef.current = merged;
    setLayout(merged);
  }, [dataFingerprint, rooms, devices]);

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null;
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.roomId, room])), [rooms]);
  const maxRoomBottom = layout
    ? Math.max(0, ...layout.rooms.map((room) => room.y + room.height))
    : 0;

  function updateLayout(updater: (current: VisualizerLayout) => VisualizerLayout, markDirty = true) {
    const current = layoutRef.current;
    if (!current) return;
    const next = updater(current);
    layoutRef.current = next;
    setLayout(next);
    if (markDirty) setDirty(true);
  }

  function startDrag(event: ReactPointerEvent, kind: DragState["kind"], id: string) {
    if (!editMode || !layoutRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    planRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind,
      id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      snapshot: structuredClone(layoutRef.current)
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const plan = planRef.current;
    if (!drag || !plan || drag.pointerId !== event.pointerId) return;
    const bounds = plan.getBoundingClientRect();
    const dx = (event.clientX - drag.startClientX) * drag.snapshot.canvas.width / bounds.width;
    const dy = (event.clientY - drag.startClientY) * drag.snapshot.canvas.height / bounds.height;

    if (drag.kind === "room") {
      const origin = drag.snapshot.rooms.find((room) => room.roomId === drag.id);
      if (!origin) return;
      const nextX = clamp(origin.x + dx, 8, drag.snapshot.canvas.width - origin.width - 8);
      const nextY = clamp(origin.y + dy, 8, drag.snapshot.canvas.height - origin.height - 8);
      updateLayout((current) => moveRoom(current, drag.id, nextX, nextY), false);
      return;
    }

    const origin = drag.snapshot.devices.find((device) => device.deviceId === drag.id);
    if (!origin) return;
    const room = drag.snapshot.rooms.find((item) => item.roomId === origin.roomId);
    if (!room) return;
    const candidate = {
      x: origin.x + dx,
      y: origin.y + dy,
      width: deviceSize,
      height: deviceSize
    };
    const roomIndex = drag.snapshot.rooms.findIndex((item) => item.roomId === room.roomId);
    const furniture = getFurniture(room, roomIndex, devices.filter((device) => device.roomId === room.roomId).length);
    const collidesWithDevice = drag.snapshot.devices
      .filter((device) => device.deviceId !== drag.id && device.roomId === room.roomId)
      .some((device) => boxesOverlap(candidate, { x: device.x, y: device.y, width: deviceSize, height: deviceSize }, 5));

    if (
      !pointInsideRoom(candidate.x, candidate.y, room)
      || furniture.some((item) => boxesOverlap(candidate, item, 6))
      || collidesWithDevice
    ) return;

    updateLayout((current) => ({
      ...current,
      devices: current.devices.map((device) =>
        device.deviceId === drag.id ? { ...device, x: candidate.x, y: candidate.y } : device
      )
    }), false);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    planRef.current?.releasePointerCapture(event.pointerId);

    if (drag.kind === "room" && layoutRef.current) {
      const currentRoom = layoutRef.current.rooms.find((room) => room.roomId === drag.id);
      const origin = drag.snapshot.rooms.find((room) => room.roomId === drag.id);
      if (currentRoom && origin) {
        const overlapTarget = layoutRef.current.rooms
          .filter((room) => room.roomId !== drag.id)
          .map((room) => ({ room, overlap: overlapArea(currentRoom, room) }))
          .sort((a, b) => b.overlap - a.overlap)[0];

        if (overlapTarget?.overlap) {
          const overlapRatio = overlapTarget.overlap / Math.min(
            currentRoom.width * currentRoom.height,
            overlapTarget.room.width * overlapTarget.room.height
          );
          if (overlapRatio >= 0.3) {
            const targetOrigin = drag.snapshot.rooms.find((room) => room.roomId === overlapTarget.room.roomId);
            if (targetOrigin) {
              updateLayout((current) => {
                const withDraggedSwapped = moveRoom(current, drag.id, targetOrigin.x, targetOrigin.y);
                return moveRoom(withDraggedSwapped, targetOrigin.roomId, origin.x, origin.y);
              });
              return;
            }
          }
          layoutRef.current = drag.snapshot;
          setLayout(drag.snapshot);
          return;
        }
      }
    }
    setDirty(true);
  }

  async function saveLayout() {
    if (!layoutRef.current) return;
    setSaving(true);
    try {
      const saved = await api.saveVisualizerLayout(layoutRef.current);
      layoutRef.current = saved;
      setLayout(saved);
      setDirty(false);
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Could not save the layout.");
    } finally {
      setSaving(false);
    }
  }

  function resetLayout() {
    const generated = generateVisualizerLayout(rooms, devices);
    layoutRef.current = generated;
    setLayout(generated);
    setDirty(true);
    setSelectedDeviceId(null);
  }

  if (!layout) {
    return <div className="frost-card grid min-h-96 place-items-center rounded-lg text-sm text-muted-foreground">Constructing office plan...</div>;
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-slate-100/80 shadow-xl shadow-slate-950/10 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white/70 px-3 py-2 backdrop-blur-xl dark:bg-white/[0.06]">
        <PlanLegend />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {storageError && <span className="max-w-72 text-right text-xs text-amber-700 dark:text-amber-300">{storageError}</span>}
          <div className="inline-flex h-9 items-center rounded-md border bg-background/70 p-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Zoom out" onClick={() => setZoom((value) => Math.max(0.75, value - 0.125))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-11 text-center text-xs font-medium">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Zoom in" onClick={() => setZoom((value) => Math.min(1.5, value + 0.125))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {editMode && (
            <>
              <Button variant="outline" size="sm" onClick={resetLayout} title="Reconstruct default layout">
                <RotateCcw className="mr-2 h-4 w-4" />Reset
              </Button>
              <Button size="sm" disabled={!dirty || saving} onClick={() => void saveLayout()}>
                <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save layout"}
              </Button>
            </>
          )}
          <Button
            variant={editMode ? "secondary" : "outline"}
            size="sm"
            className="glass-button"
            onClick={() => setEditMode((value) => !value)}
          >
            {editMode ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
            {editMode ? "Finish editing" : "Edit layout"}
          </Button>
        </div>
      </div>

      {editMode && (
        <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-950 dark:text-cyan-100">
          <Move className="h-4 w-4 shrink-0" />
          Drag rooms to open space or onto another room to swap them. Drag devices within their room.
        </div>
      )}

      <div className="office-plan-scroll overflow-auto p-3 sm:p-5">
        <div style={{ width: `${zoom * 100}%`, minWidth: `${Math.round(760 * zoom)}px` }}>
          <div
            ref={planRef}
            className={cn("office-floor-plan relative isolate overflow-hidden border-[6px] border-zinc-700 bg-[#e7e0cf] shadow-2xl", editMode && "is-editing")}
            style={{ aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}` }}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <div
              className="office-corridor absolute border-t-[5px] border-zinc-700"
              style={{
                left: 0,
                right: 0,
                top: `${maxRoomBottom / layout.canvas.height * 100}%`,
                bottom: 0
              }}
            >
              <span className="exit-label absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white shadow">EXIT</span>
              <DoorOpen className="absolute bottom-7 left-1/2 h-10 w-10 -translate-x-1/2 text-zinc-700" strokeWidth={1.4} />
              <TreePine className="absolute bottom-5 left-5 h-9 w-9 text-emerald-700/80" />
              <TreePine className="absolute bottom-5 right-16 h-8 w-8 text-emerald-700/80" />
            </div>

            {layout.rooms.map((placement, roomIndex) => {
              const room = roomById.get(placement.roomId);
              if (!room) return null;
              const roomDevices = devices.filter((device) => device.roomId === room.roomId);
              const roomAlerts = alerts.filter((alert) =>
                alert.roomId === room.roomId || roomDevices.some((device) => device.id === alert.deviceId)
              );
              const node = nodes.find((item) => item.roomId === room.roomId);
              return (
                <RoomOnPlan
                  key={room.roomId}
                  placement={placement}
                  room={room}
                  roomIndex={roomIndex}
                  deviceCount={roomDevices.length}
                  node={node}
                  alertCount={roomAlerts.length}
                  canvas={layout.canvas}
                  editMode={editMode}
                  onPointerDown={(event) => startDrag(event, "room", room.roomId)}
                />
              );
            })}

            {layout.devices.map((placement) => {
              const device = devices.find((item) => item.id === placement.deviceId);
              if (!device) return null;
              const hasAlert = alerts.some((alert) => alert.deviceId === device.id);
              return (
                <DeviceOnPlan
                  key={device.id}
                  device={device}
                  x={placement.x}
                  y={placement.y}
                  canvas={layout.canvas}
                  editMode={editMode}
                  selected={selectedDeviceId === device.id}
                  hasAlert={hasAlert}
                  onPointerDown={(event) => startDrag(event, "device", device.id)}
                  onClick={() => {
                    if (!editMode) setSelectedDeviceId((current) => current === device.id ? null : device.id);
                  }}
                />
              );
            })}

            {selectedDevice && !editMode && (
              <DeviceInspector
                device={selectedDevice}
                roomName={selectedDevice.roomId ? roomById.get(selectedDevice.roomId)?.name : undefined}
                onClose={() => setSelectedDeviceId(null)}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoomOnPlan({
  placement,
  room,
  roomIndex,
  deviceCount,
  node,
  alertCount,
  canvas,
  editMode,
  onPointerDown
}: {
  placement: VisualizerRoomPlacement;
  room: RoomSummary;
  roomIndex: number;
  deviceCount: number;
  node?: NodeSummary;
  alertCount: number;
  canvas: VisualizerLayout["canvas"];
  editMode: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
}) {
  const furniture = getFurniture(placement, roomIndex, deviceCount);
  return (
    <div
      className={cn(
        "office-room absolute border-[3px] border-zinc-700",
        `office-room-${placement.theme}`,
        editMode && "cursor-move ring-inset hover:ring-2 hover:ring-cyan-500"
      )}
      style={positionStyle(placement, canvas)}
      onPointerDown={onPointerDown}
    >
      <div className="office-window absolute -top-[5px] left-[16%] h-[8px] w-[24%]" />
      <div className="office-window absolute -top-[5px] right-[16%] h-[8px] w-[24%]" />
      <DoorOpen className="absolute -bottom-2 left-1/2 z-10 h-10 w-10 -translate-x-1/2 bg-white/40 text-zinc-700" strokeWidth={1.3} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/60 bg-white/72 px-3 py-1.5 text-center shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-black/55">
        <p className="max-w-36 truncate text-[11px] font-bold uppercase text-zinc-800 dark:text-zinc-100">{room.name}</p>
        <div className="mt-0.5 flex items-center justify-center gap-2 whitespace-nowrap text-[9px] text-zinc-600 dark:text-zinc-300">
          <span>{formatWatts(room.currentPowerWatts)}</span>
          <span>{deviceCount} devices</span>
          <Wifi className={cn("h-3 w-3", node?.status === "active" ? "text-emerald-600" : "text-zinc-400")} />
          {alertCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-600" />}
        </div>
      </div>
      {furniture.map((item) => (
        <Furniture key={item.id} item={item} room={placement} />
      ))}
    </div>
  );
}

function Furniture({ item, room }: { item: FurnitureItem; room: VisualizerRoomPlacement }) {
  const style = {
    left: `${(item.x - room.x) / room.width * 100}%`,
    top: `${(item.y - room.y) / room.height * 100}%`,
    width: `${item.width / room.width * 100}%`,
    height: `${item.height / room.height * 100}%`,
    transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined
  };

  if (item.kind === "plant") {
    return <TreePine className="pointer-events-none absolute z-[2] text-emerald-700/80 drop-shadow" style={style} />;
  }
  if (item.kind === "chair") {
    return <Armchair className="pointer-events-none absolute z-[2] text-stone-600" style={style} strokeWidth={1.4} />;
  }
  if (item.kind === "sofa") {
    return (
      <div className="office-sofa pointer-events-none absolute z-[2]" style={style}>
        <span /><span /><span />
      </div>
    );
  }
  if (item.kind === "meeting-table") {
    return <div className="office-meeting-table pointer-events-none absolute z-[2]" style={style} />;
  }
  return (
    <div className="office-desk pointer-events-none absolute z-[2]" style={style}>
      <Monitor className="h-[52%] w-[42%] text-zinc-700" strokeWidth={1.5} />
      <span className="office-chair" />
    </div>
  );
}

function DeviceOnPlan({
  device,
  x,
  y,
  canvas,
  editMode,
  selected,
  hasAlert,
  onPointerDown,
  onClick
}: {
  device: DeviceSummary;
  x: number;
  y: number;
  canvas: VisualizerLayout["canvas"];
  editMode: boolean;
  selected: boolean;
  hasAlert: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onClick: () => void;
}) {
  const isOn = device.status === "on";
  const Icon = device.type === "fan" ? Fan : device.type === "light" ? Lightbulb : PlugZap;
  return (
    <button
      type="button"
      className={cn(
        "office-device absolute z-30 grid place-items-center rounded-full border-2 shadow-md transition",
        editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:scale-110",
        device.type === "light" && isOn && "border-amber-400 bg-amber-100 text-amber-700 shadow-amber-400/50",
        device.type === "fan" && isOn && "border-cyan-500 bg-cyan-100 text-cyan-800 shadow-cyan-400/35",
        device.type !== "light" && device.type !== "fan" && isOn && "border-emerald-500 bg-emerald-100 text-emerald-800",
        !isOn && "border-zinc-400 bg-zinc-200/90 text-zinc-500",
        selected && "ring-4 ring-cyan-500/40",
        hasAlert && "ring-4 ring-amber-500/50"
      )}
      style={{
        left: `${x / canvas.width * 100}%`,
        top: `${y / canvas.height * 100}%`,
        width: `${deviceSize / canvas.width * 100}%`,
        height: `${deviceSize / canvas.height * 100}%`
      }}
      title={`${device.type} · ${device.status} · ${formatWatts(device.powerWatts)}`}
      aria-label={`${device.type}, ${device.status}, ${formatWatts(device.powerWatts)}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <Icon className={cn("h-[62%] w-[62%]", device.type === "fan" && isOn && "fan-spin")} strokeWidth={1.7} />
      <span className={cn("absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white", isOn ? "bg-emerald-500" : "bg-zinc-400")} />
    </button>
  );
}

function DeviceInspector({ device, roomName, onClose }: { device: DeviceSummary; roomName?: string; onClose: () => void }) {
  return (
    <div className="absolute bottom-3 right-3 z-40 w-56 rounded-lg border border-white/60 bg-white/82 p-3 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-zinc-950/82">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold capitalize">{device.type}</p>
          <p className="text-[10px] text-muted-foreground">{roomName ?? "Unassigned"} · {device.status}</p>
        </div>
        <button type="button" title="Close details" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <span><b className="block text-xs">{formatWatts(device.powerWatts)}</b>Power</span>
        <span><b className="block text-xs">{formatBdt(device.costBdtToday)}</b>Today</span>
        <span><b className="block text-xs">{device.voltageVolts} V</b>Voltage</span>
        <span><b className="block text-xs">{device.currentAmps} A</b>Current</span>
      </div>
    </div>
  );
}

function PlanLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="font-semibold text-foreground">Legend</span>
      <span className="inline-flex items-center gap-1.5"><Fan className="h-4 w-4 text-cyan-600" />Fan</span>
      <span className="inline-flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-amber-500" />Light</span>
      <span className="inline-flex items-center gap-1.5"><PlugZap className="h-4 w-4 text-emerald-600" />Device</span>
      <span className="inline-flex items-center gap-1.5"><DoorOpen className="h-4 w-4" />Door</span>
      <span className="inline-flex items-center gap-1.5"><i className="office-window block h-1.5 w-6" />Window</span>
    </div>
  );
}

function positionStyle(box: VisualizerRoomPlacement, canvas: VisualizerLayout["canvas"]) {
  return {
    left: `${box.x / canvas.width * 100}%`,
    top: `${box.y / canvas.height * 100}%`,
    width: `${box.width / canvas.width * 100}%`,
    height: `${box.height / canvas.height * 100}%`
  };
}

function moveRoom(layout: VisualizerLayout, roomId: string, x: number, y: number): VisualizerLayout {
  const room = layout.rooms.find((item) => item.roomId === roomId);
  if (!room) return layout;
  const dx = x - room.x;
  const dy = y - room.y;
  return {
    ...layout,
    rooms: layout.rooms.map((item) => item.roomId === roomId ? { ...item, x, y } : item),
    devices: layout.devices.map((device) =>
      device.roomId === roomId ? { ...device, x: device.x + dx, y: device.y + dy } : device
    )
  };
}

function overlapArea(a: VisualizerRoomPlacement, b: VisualizerRoomPlacement): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
