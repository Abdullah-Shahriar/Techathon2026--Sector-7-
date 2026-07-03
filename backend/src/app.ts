import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { alertRouter } from "./alerts/alert.routes.js";
import { deviceRouter } from "./devices/device.routes.js";
import { healthRouter } from "./health/health.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { nodeRouter } from "./nodes/node.routes.js";
import { roomRouter } from "./rooms/room.routes.js";
import { stateRouter } from "./state/state.routes.js";
import { settingsRouter } from "./settings/settings.routes.js";
import { telemetryRouter } from "./telemetry/telemetry.routes.js";
import { usageRouter } from "./usage/usage.routes.js";
import { logger } from "./logger.js";

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        ok: false,
        error: {
          message: "Too many requests. Please wait a moment and try again."
        }
      });
    }
  }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use("/api/iot/telemetry", telemetryRouter);
  app.use("/api/state", stateRouter);
  app.use("/api/rooms", roomRouter);
  app.use("/api/nodes", nodeRouter);
  app.use("/api/devices", deviceRouter);
  app.use("/api/usage", usageRouter);
  app.use("/api/alerts", alertRouter);
  app.use("/api/settings", settingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
