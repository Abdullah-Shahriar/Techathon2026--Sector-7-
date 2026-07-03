import http from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { connectMongo, disconnectMongo } from "./db/mongoose.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";
import { checkOfflineNodes, evaluateAggregateAlerts } from "./alerts/alert.service.js";
import { ensureSettings } from "./settings/settings.service.js";
import { setSocketServer } from "./realtime/socket.js";

async function main(): Promise<void> {
  await connectMongo();
  await ensureSettings();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true
    }
  });
  setSocketServer(io);

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");
    socket.emit("connected", { ok: true });
  });

  const offlineTimer = setInterval(() => {
    void (async () => {
      await checkOfflineNodes();
      await evaluateAggregateAlerts();
    })().catch((error) => logger.error({ error }, "Background alert check failed"));
  }, 10_000);

  server.listen(config.port, () => {
    logger.info({ port: config.port }, "OfficePulse backend listening");
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, "Shutdown requested");
    clearInterval(offlineTimer);
    io.close();
    server.close();
    await disconnectMongo();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

await main();
