import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      "DISCORD_BOT_TOKEN",
      "GEMINI_API_KEY",
      "BACKEND_API_KEY",
      "DEVICE_API_KEY",
      "*.DISCORD_BOT_TOKEN",
      "*.GEMINI_API_KEY",
      "*.BACKEND_API_KEY",
      "*.DEVICE_API_KEY"
    ],
    censor: "[redacted]"
  }
});
