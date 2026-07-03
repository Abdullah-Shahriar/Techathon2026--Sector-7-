import { connectMongo, disconnectMongo } from "./db/mongoose.js";
import { logger } from "./logger.js";
import { ensureSettings } from "./settings/settings.service.js";

await connectMongo();
const settings = await ensureSettings();
logger.info({
  settingsId: String(settings._id),
  officeStartTime: settings.officeStartTime,
  officeEndTime: settings.officeEndTime,
  timezone: settings.timezone,
  bdtPerUnitKwh: settings.bdtPerUnitKwh
}, "Seeded default settings and alert settings");
await disconnectMongo();
