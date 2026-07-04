import type { Client } from "discord.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { BackendClient } from "../backend/backendClient.js";
import type { AlertSummary } from "../backend/backendTypes.js";
import type { Humanizer } from "../ai/humanizer.js";
import { alertEmbed, baseEmbed, colors } from "../messages/embeds.js";
import type { GuildConfigStore } from "../storage/guildConfigStore.js";
import { connectBackendSocket } from "./backendSocket.js";

interface ProactiveDependencies {
  client: Client;
  backend: BackendClient;
  humanizer: Humanizer;
  guildStore: GuildConfigStore;
}

export function startProactiveAlerts({ client, backend, humanizer, guildStore }: ProactiveDependencies): void {
  if (!config.ENABLE_PROACTIVE_ALERTS) return;
  const sent = new Set<string>();

  const sendAlert = async (alert: AlertSummary & { occurrence?: { id?: string | null; repeatNumber?: number } }): Promise<void> => {
    const key = alertKey(alert);
    if (sent.has(key)) return;
    sent.add(key);

    const guilds = [...client.guilds.cache.values()];
    for (const guild of guilds) {
      const guildConfig = await guildStore.get(guild.id);
      if (!guildConfig.proactiveAlertsEnabled || !guildConfig.alertChannelId) continue;
      const channel = await client.channels.fetch(guildConfig.alertChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        logger.warn({ guildId: guild.id, channelId: guildConfig.alertChannelId }, "Configured alert channel is unavailable");
        continue;
      }
      const humanText = guildConfig.aiHumanizationEnabled
        ? await humanizer.alert(alert, `alert:${key}`)
        : `${alert.title}: ${alert.message}`;
      await sendToChannel(channel, { embeds: [alertEmbed(alert, humanText)] }).catch((error: unknown) => {
        logger.warn({ error: error instanceof Error ? error.message : String(error), channelId: guildConfig.alertChannelId }, "Failed to send proactive alert");
      });
    }
  };

  connectBackendSocket({
    alertCreated: (alert) => void sendAlert(alert),
    nodeEvent: (event, node) => void sendNodeEvent(client, guildStore, event, node.nodeId ?? "unknown", node.status ?? "unknown")
  });

  const intervalMs = config.ALERT_POLL_INTERVAL_SECONDS * 1000;
  setInterval(() => {
    void backend.alerts("active")
      .then((alerts) => Promise.all(alerts.map((alert) => sendAlert(alert))))
      .catch((error) => logger.warn({ error: error instanceof Error ? error.message : String(error) }, "Alert polling failed"));
  }, intervalMs).unref();
}

async function sendNodeEvent(client: Client, guildStore: GuildConfigStore, event: string, nodeId: string, status: string): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const guildConfig = await guildStore.get(guild.id);
    if (!guildConfig.proactiveAlertsEnabled || !guildConfig.alertChannelId) continue;
    const channel = await client.channels.fetch(guildConfig.alertChannelId).catch(() => null);
    if (!channel?.isTextBased()) continue;
    await sendToChannel(channel, {
      embeds: [
        baseEmbed(`Node ${event.replace("node_", "")}`, `${nodeId} is now ${status}.`)
          .setColor(event === "node_offline" ? colors.warning : colors.info)
      ]
    }).catch(() => undefined);
  }
}

function alertKey(alert: AlertSummary & { occurrence?: { id?: string | null; repeatNumber?: number } }): string {
  const occurrence = alert.occurrence ?? alert.occurrences?.at(-1);
  return [alert.id, occurrence?.id ?? occurrence?.repeatNumber ?? alert.lastRepeatedAt ?? alert.createdAt ?? "first"].join(":");
}

function sendToChannel(channel: unknown, payload: { embeds: unknown[] }): Promise<unknown> {
  const sendable = channel as { send?: (payload: { embeds: unknown[] }) => Promise<unknown> };
  if (!sendable.send) return Promise.reject(new Error("Channel is not sendable"));
  return sendable.send(payload);
}
