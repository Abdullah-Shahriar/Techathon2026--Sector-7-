import http from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { connectMongo, disconnectMongo } from "./db/mongoose.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";
import { checkOfflineNodes, scheduleAggregateAlerts } from "./alerts/alert.service.js";
import { ensureSettings } from "./settings/settings.service.js";
import { setSocketServer } from "./realtime/socket.js";

async function main(): Promise<void> {
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

  let offlineTimer: NodeJS.Timeout | null = null;

  const startBackgroundJobs = (): void => {
    if (offlineTimer) return;
    offlineTimer = setInterval(() => {
      void (async () => {
        await checkOfflineNodes();
        scheduleAggregateAlerts();
      })().catch((error) => logger.error({ error }, "Background alert check failed"));
    }, 10_000);
  };

  server.listen(config.port, () => {
    logger.info({ port: config.port }, "OfficePulse backend listening");
  });

  void initializeDatabaseWithRetry(startBackgroundJobs);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, "Shutdown requested");
    if (offlineTimer) {
      clearInterval(offlineTimer);
    }
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

async function initializeDatabaseWithRetry(onReady: () => void, attempt = 1): Promise<void> {
  try {
    await connectMongo();
    await ensureSettings();
    onReady();
    logger.info("Backend database initialization complete");
  } catch (error) {
    const retryMs = Math.min(30_000, 2_000 * attempt);
    logger.error({
      attempt,
      retryMs,
      error: error instanceof Error ? error.message : String(error)
    }, "Backend database initialization failed; retrying");
    setTimeout(() => {
      void initializeDatabaseWithRetry(onReady, attempt + 1);
    }, retryMs).unref();
  }
}

await main();
