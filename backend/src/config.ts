import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  mongodbUri: string;
  port: number;
  deviceApiKey: string;
  corsOrigin: string;
  defaultTimezone: string;
  defaultBdtPerKwh: number;
  defaultOfficeStartTime: string;
  defaultOfficeEndTime: string;
  defaultAlertRepeatMinutes: number;
  heartbeatTimeoutSeconds: number;
  nodeEnv: string;
}

export const config: AppConfig = {
  mongodbUri: envString("MONGODB_URI", "mongodb://127.0.0.1:27017/officepulse"),
  port: envNumber("PORT", 4000),
  deviceApiKey: envString("DEVICE_API_KEY", "dev-device-key"),
  corsOrigin: envString("CORS_ORIGIN", "http://localhost:3000"),
  defaultTimezone: envString("DEFAULT_TIMEZONE", "Asia/Dhaka"),
  defaultBdtPerKwh: envNumber("DEFAULT_BDT_PER_KWH", 12),
  defaultOfficeStartTime: envString("DEFAULT_OFFICE_START_TIME", "09:00"),
  defaultOfficeEndTime: envString("DEFAULT_OFFICE_END_TIME", "18:00"),
  defaultAlertRepeatMinutes: envNumber("DEFAULT_ALERT_REPEAT_MINUTES", 120),
  heartbeatTimeoutSeconds: envNumber("HEARTBEAT_TIMEOUT_SECONDS", 20),
  nodeEnv: envString("NODE_ENV", "development")
};

function envString(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }

  return parsed;
}
