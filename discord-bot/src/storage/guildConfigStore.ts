import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";

const guildConfigSchema = z.object({
  alertChannelId: z.string().optional(),
  proactiveAlertsEnabled: z.boolean().optional(),
  aiHumanizationEnabled: z.boolean().optional()
});

const storeSchema = z.record(z.string(), guildConfigSchema);

export type GuildConfig = z.infer<typeof guildConfigSchema>;

export class GuildConfigStore {
  private readonly filePath: string;
  private data: Record<string, GuildConfig> = {};
  private loaded = false;

  constructor(filePath = path.resolve(process.cwd(), "data", "guild-config.json")) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = storeSchema.parse(JSON.parse(raw));
    } catch (error) {
      this.data = {};
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn({ error: error instanceof Error ? error.message : String(error) }, "Guild config store reset after invalid read");
      }
    }
    this.loaded = true;
  }

  async get(guildId: string | null | undefined): Promise<GuildConfig> {
    await this.load();
    if (!guildId) {
      return {
        alertChannelId: config.ALERT_CHANNEL_ID,
        proactiveAlertsEnabled: config.ENABLE_PROACTIVE_ALERTS,
        aiHumanizationEnabled: config.ENABLE_AI_HUMANIZATION
      };
    }
    return {
      alertChannelId: this.data[guildId]?.alertChannelId ?? config.ALERT_CHANNEL_ID,
      proactiveAlertsEnabled: this.data[guildId]?.proactiveAlertsEnabled ?? config.ENABLE_PROACTIVE_ALERTS,
      aiHumanizationEnabled: this.data[guildId]?.aiHumanizationEnabled ?? config.ENABLE_AI_HUMANIZATION
    };
  }

  async update(guildId: string, patch: GuildConfig): Promise<GuildConfig> {
    await this.load();
    this.data[guildId] = { ...this.data[guildId], ...patch };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    return this.get(guildId);
  }
}
