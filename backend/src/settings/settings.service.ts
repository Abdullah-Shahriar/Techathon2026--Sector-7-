import { z } from "zod";
import { config } from "../config.js";
import { AlertSetting, Settings, type SettingsDocument } from "../models/index.js";

const defaultAlertTypes = [
  "off_time_device_on",
  "esp32_offline",
  "missing_heartbeat",
  "esp32_back_online",
  "unknown_esp32_discovered",
  "new_device_discovered",
  "missed_telemetry_sequence",
  "device_on_power_zero",
  "device_off_power_flowing",
  "abnormal_high_power",
  "high_room_usage",
  "high_office_usage",
  "high_off_time_cost",
  "high_monthly_estimate"
] as const;

export const updateSettingsSchema = z.object({
  officeStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  officeEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().min(1).optional(),
  bdtPerUnitKwh: z.number().nonnegative().optional(),
  defaultAlertRepeatMinutes: z.number().int().positive().optional(),
  heartbeatTimeoutSeconds: z.number().int().positive().optional()
});

export async function ensureSettings(): Promise<SettingsDocument> {
  const settings = await Settings.findOneAndUpdate(
    { key: "default" },
    {
      $setOnInsert: {
        key: "default",
        officeStartTime: config.defaultOfficeStartTime,
        officeEndTime: config.defaultOfficeEndTime,
        timezone: config.defaultTimezone,
        bdtPerUnitKwh: config.defaultBdtPerKwh,
        defaultAlertRepeatMinutes: config.defaultAlertRepeatMinutes,
        heartbeatTimeoutSeconds: config.heartbeatTimeoutSeconds
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await seedDefaultAlertSettings(settings);
  return settings;
}

export async function getSettings(): Promise<SettingsDocument> {
  return ensureSettings();
}

export async function updateSettings(input: z.infer<typeof updateSettingsSchema>): Promise<SettingsDocument> {
  const parsed = updateSettingsSchema.parse(input);
  return Settings.findOneAndUpdate({ key: "default" }, { $set: parsed }, { new: true, upsert: true });
}

export async function seedDefaultAlertSettings(settings: SettingsDocument): Promise<void> {
  await Promise.all(
    defaultAlertTypes.map((alertType) => (
      AlertSetting.findOneAndUpdate(
        { scope: "global", roomId: null, deviceId: null, alertType },
        {
          $setOnInsert: {
            scope: "global",
            roomId: null,
            deviceId: null,
            alertType,
            enabled: true,
            severity: defaultSeverity(alertType),
            thresholdJson: defaultThreshold(alertType),
            repeatEveryMinutes: settings.defaultAlertRepeatMinutes
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ))
  );
}

function defaultSeverity(alertType: string): "info" | "warning" | "critical" {
  if (alertType === "unknown_esp32_discovered" || alertType === "new_device_discovered" || alertType === "esp32_back_online") {
    return "info";
  }

  if (alertType === "esp32_offline" || alertType === "missing_heartbeat" || alertType === "device_off_power_flowing") {
    return "critical";
  }

  return "warning";
}

function defaultThreshold(alertType: string): Record<string, number> | null {
  if (alertType === "abnormal_high_power") {
    return { multiplier: 1.5 };
  }

  if (alertType === "high_room_usage") {
    return { powerWatts: 150 };
  }

  if (alertType === "high_office_usage") {
    return { powerWatts: 450 };
  }

  if (alertType === "high_off_time_cost") {
    return { bdt: 100 };
  }

  if (alertType === "high_monthly_estimate") {
    return { bdt: 5000 };
  }

  return null;
}
