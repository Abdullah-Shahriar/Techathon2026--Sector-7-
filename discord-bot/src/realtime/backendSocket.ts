import { io, type Socket } from "socket.io-client";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { AlertSummary, NodeSummary } from "../backend/backendTypes.js";

export interface BackendSocketHandlers {
  alertCreated(alert: AlertSummary & { occurrence?: { id?: string | null; repeatNumber?: number } }): void;
  nodeEvent?(event: string, node: NodeSummary): void;
}

export function connectBackendSocket(handlers: BackendSocketHandlers): Socket {
  const socket = io(config.BACKEND_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
  });

  socket.on("connect", () => logger.info({ socketId: socket.id }, "Connected to backend Socket.IO"));
  socket.on("disconnect", (reason) => logger.warn({ reason }, "Disconnected from backend Socket.IO"));
  socket.on("connect_error", (error) => logger.warn({ error: error.message }, "Backend Socket.IO connect error"));
  socket.on("alert_created", (payload) => handlers.alertCreated(payload));
  for (const event of ["node_discovered", "node_online", "node_offline"] as const) {
    socket.on(event, (payload) => handlers.nodeEvent?.(event, payload));
  }

  return socket;
}
