import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketServer(server: Server): void {
  io = server;
}

export function emitRealtime(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
