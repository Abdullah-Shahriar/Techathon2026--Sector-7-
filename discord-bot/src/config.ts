import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const booleanString = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
});

const optionalString = z.string().trim().optional().transform((value) => value || undefined);

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().trim().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().trim().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: optionalString,
  BACKEND_URL: z.string().trim().url().default("http://localhost:4000"),
  BACKEND_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-flash-latest"),
  ALERT_CHANNEL_ID: optionalString,
  COMMAND_PREFIX: z.string().min(1).default("!"),
  ENABLE_PREFIX_COMMANDS: booleanString.default(true),
  ENABLE_SLASH_COMMANDS: booleanString.default(true),
  ENABLE_PROACTIVE_ALERTS: booleanString.default(true),
  ENABLE_AI_HUMANIZATION: booleanString.default(true),
  AI_FALLBACK_TO_RULE_BASED: booleanString.default(true),
  ALERT_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  COMMAND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(3),
  AI_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(5),
  BACKEND_CACHE_SECONDS: z.coerce.number().int().nonnegative().default(5),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid Discord bot environment: ${details}`);
}

export const config = {
  ...parsed.data,
  BACKEND_URL: parsed.data.BACKEND_URL.replace(/\/+$/, "")
};

export type BotConfig = typeof config;
