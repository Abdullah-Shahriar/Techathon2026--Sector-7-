import { ChannelType, EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { BackendClient, UsageQuery } from "../backend/backendClient.js";
import type { AlertSummary, DeviceSummary, OfficeState, RoomSummary } from "../backend/backendTypes.js";
import { config } from "../config.js";
import { Humanizer } from "../ai/humanizer.js";
import type { DeviceUsageResponse, RoomUsageResponse } from "../backend/backendTypes.js";
import {
  alertEmbed,
  alertsListEmbed,
  baseEmbed,
  colors,
  deviceEmbed,
  devicesEmbed,
  helpEmbed,
  nodesEmbed,
  officeStatusEmbed,
  roomStatusEmbed,
  usageEmbed,
  visualEmbed
} from "../messages/embeds.js";
import type { GuildConfigStore } from "../storage/guildConfigStore.js";
import { FriendlyError } from "../utils/errors.js";
import { bdt, kwh, roomLabel, watts } from "../utils/format.js";
import { requireDevice, requireRoom } from "../utils/matching.js";

export interface CommandServices {
  backend: BackendClient;
  humanizer: Humanizer;
  guildStore: GuildConfigStore;
}

export interface CommandRequest {
  userId: string;
  guildId?: string | null;
  options: Record<string, string | number | boolean | null | undefined>;
  args: string[];
  isAdmin?: boolean;
}

export interface CommandResult {
  content?: string;
  embeds?: EmbedBuilder[];
  ephemeral?: boolean;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  data: { toJSON(): unknown };
  execute(request: CommandRequest, services: CommandServices): Promise<CommandResult>;
}

const rangeChoices = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "this_month",
  "last_30_days",
  "this_year",
  "custom"
].map((range) => ({ name: range.replaceAll("_", " "), value: range }));

export const commandDefinitions: CommandDefinition[] = [
  {
    name: "status",
    data: new SlashCommandBuilder().setName("status").setDescription("Show humanized whole-office status."),
    async execute(request, services) {
      const [state, usage] = await Promise.all([services.backend.state(), services.backend.usageSummary({ range: "today" })]);
      const humanText = await services.humanizer.officeStatus(state, usage, aiKey(request, "status"));
      return { embeds: [officeStatusEmbed(state, humanText)] };
    }
  },
  {
    name: "room",
    data: new SlashCommandBuilder()
      .setName("room")
      .setDescription("Show status for a room.")
      .addStringOption((option) => option.setName("room").setDescription("Room name or room ID").setRequired(true).setAutocomplete(true)),
    async execute(request, services) {
      const state = await services.backend.state();
      const room = requireRoom(state.rooms, optionString(request, "room") ?? request.args.join(" "));
      const devices = state.devices.filter((device) => device.roomId === room.roomId);
      const alerts = state.activeAlerts.filter((alert) => alert.roomId === room.roomId || devices.some((device) => device.id === alert.deviceId));
      const humanText = await services.humanizer.roomStatus(room, devices, alerts, aiKey(request, "room"));
      return { embeds: [roomStatusEmbed(room, devices, alerts, humanText)] };
    }
  },
  {
    name: "usage",
    data: new SlashCommandBuilder()
      .setName("usage")
      .setDescription("Show backend usage summary.")
      .addStringOption((option) => option.setName("range").setDescription("Usage range").addChoices(...rangeChoices))
      .addStringOption((option) => option.setName("room").setDescription("Optional room name or ID").setAutocomplete(true))
      .addStringOption((option) => option.setName("device").setDescription("Optional device ID").setAutocomplete(true))
      .addStringOption((option) => option.setName("start").setDescription("Custom start ISO date"))
      .addStringOption((option) => option.setName("end").setDescription("Custom end ISO date")),
    async execute(request, services) {
      const state = await services.backend.state();
      const query = usageQueryFromRequest(request, state);
      const [usage, roomUsage, deviceUsage] = await Promise.all([
        services.backend.usageSummary(query),
        services.backend.roomUsage(query),
        services.backend.deviceUsage(query)
      ]);
      const topRoom = topRoomUsage(roomUsage);
      const topDevice = topDeviceUsage(deviceUsage);
      const humanText = await services.humanizer.usageSummary(usage, state.rooms, state.devices, aiKey(request, "usage"), topRoom, topDevice);
      return { embeds: [usageEmbed(usage, humanText)] };
    }
  },
  {
    name: "alerts",
    data: new SlashCommandBuilder()
      .setName("alerts")
      .setDescription("Show active, acknowledged, or resolved alerts.")
      .addStringOption((option) => option.setName("status").setDescription("Alert status").addChoices(
        { name: "active", value: "active" },
        { name: "acknowledged", value: "acknowledged" },
        { name: "resolved", value: "resolved" }
      ))
      .addStringOption((option) => option.setName("severity").setDescription("Optional severity filter").addChoices(
        { name: "info", value: "info" },
        { name: "warning", value: "warning" },
        { name: "critical", value: "critical" }
      ))
      .addStringOption((option) => option.setName("room").setDescription("Optional room name or ID"))
      .addStringOption((option) => option.setName("device").setDescription("Optional device ID")),
    async execute(request, services) {
      const state = await services.backend.state();
      const status = optionString(request, "status") ?? request.args[0] ?? "active";
      const severity = optionString(request, "severity");
      const roomQuery = optionString(request, "room");
      const deviceQuery = optionString(request, "device");
      const room = roomQuery ? requireRoom(state.rooms, roomQuery) : null;
      const device = deviceQuery ? requireDevice(state.devices, deviceQuery) : null;
      const alerts = (status === "active" ? state.activeAlerts : await services.backend.alerts(status))
        .filter((alert) => !severity || alert.severity === severity)
        .filter((alert) => !room || alert.roomId === room.roomId)
        .filter((alert) => !device || alert.deviceId === device.id);
      const humanText = await services.humanizer.alerts(alerts, aiKey(request, "alerts"));
      return { embeds: [alertsListEmbed(alerts, humanText, `${status} alerts`)] };
    }
  },
  {
    name: "devices",
    data: new SlashCommandBuilder()
      .setName("devices")
      .setDescription("List devices, optionally filtered by room.")
      .addStringOption((option) => option.setName("room").setDescription("Optional room name or ID").setAutocomplete(true)),
    async execute(request, services) {
      const state = await services.backend.state();
      const roomQuery = optionString(request, "room") ?? request.args.join(" ");
      const room = roomQuery ? requireRoom(state.rooms, roomQuery) : null;
      const devices = room ? state.devices.filter((device) => device.roomId === room.roomId) : state.devices;
      const humanText = await services.humanizer.generic(
        "devices list",
        { devices, rooms: state.rooms, room },
        room
          ? `${room.name} has ${devices.filter((device) => device.status === "on").length}/${devices.length} device(s) ON right now.`
          : `${devices.filter((device) => device.status === "on").length}/${devices.length} office device(s) are ON right now.`,
        aiKey(request, "devices")
      );
      return { embeds: [devicesEmbed(devices, state.rooms, room ? `${room.name} devices` : "Devices", humanText)] };
    }
  },
  {
    name: "device",
    data: new SlashCommandBuilder()
      .setName("device")
      .setDescription("Show detailed single-device status.")
      .addStringOption((option) => option.setName("device").setDescription("Device ID or name").setRequired(true).setAutocomplete(true)),
    async execute(request, services) {
      const state = await services.backend.state();
      const device = requireDevice(state.devices, optionString(request, "device") ?? request.args.join(" "));
      const room = state.rooms.find((item) => item.roomId === device.roomId);
      const alerts = state.activeAlerts.filter((alert) => alert.deviceId === device.id);
      const description = await services.humanizer.deviceStatus(device, room, alerts, aiKey(request, "device"));
      return { embeds: [deviceEmbed(device, room, alerts, description)] };
    }
  },
  {
    name: "nodes",
    data: new SlashCommandBuilder().setName("nodes").setDescription("Show ESP32 node health."),
    async execute(request, services) {
      const state = await services.backend.state();
      const humanText = await services.humanizer.nodes(state.nodes, state.pendingNodes, aiKey(request, "nodes"));
      return { embeds: [nodesEmbed(state.nodes, state.pendingNodes, humanText)] };
    }
  },
  {
    name: "pending",
    data: new SlashCommandBuilder().setName("pending").setDescription("Show pending discovered ESP32 nodes."),
    async execute(request, services) {
      const pending = await services.backend.pendingNodes();
      const humanText = await services.humanizer.generic(
        "pending nodes",
        { pending },
        pending.length ? `${pending.length} pending node(s) need assignment before rooms are fully organized.` : "No pending ESP32 nodes are waiting for assignment.",
        aiKey(request, "pending")
      );
      return { embeds: [nodesEmbed([], pending, humanText)] };
    }
  },
  {
    name: "top",
    data: new SlashCommandBuilder()
      .setName("top")
      .setDescription("Show top consuming rooms and devices from backend data.")
      .addStringOption((option) => option.setName("range").setDescription("Usage range").addChoices(...rangeChoices))
      .addIntegerOption((option) => option.setName("limit").setDescription("Number of rows").setMinValue(1).setMaxValue(10)),
    async execute(request, services) {
      const state = await services.backend.state();
      const range = optionString(request, "range") ?? request.args[0] ?? "today";
      const limit = Number(optionNumber(request, "limit") ?? request.args[1] ?? 5);
      const [roomUsage, deviceUsage] = await Promise.all([
        services.backend.roomUsage({ range }),
        services.backend.deviceUsage({ range })
      ]);
      const topRooms = [...roomUsage.rooms].sort((a, b) => b.unitKwh - a.unitKwh).slice(0, limit);
      const topDevices = [...deviceUsage.devices].sort((a, b) => b.unitKwh - a.unitKwh).slice(0, limit);
      const roomLines = topRooms.map((item, index) => {
        const room = state.rooms.find((candidate) => candidate.roomId === item.roomId);
        return `${index + 1}. ${roomLabel(room, item.roomId)} - ${kwh(item.unitKwh)} / ${bdt(item.costBdt)}`;
      });
      const deviceLines = topDevices.map((item, index) => {
        const device = state.devices.find((candidate) => candidate.id === item.deviceId);
        return `${index + 1}. ${device?.name ?? item.deviceId} - ${kwh(item.unitKwh)} / ${bdt(item.costBdt)}`;
      });
      const fallback = topRooms.length
        ? `For ${range}, the highest backend-reported room is ${roomLines[0]}. The top device is ${deviceLines[0] ?? "unavailable"}.`
        : `No ranked usage is available for ${range} yet.`;
      const humanText = await services.humanizer.generic("top usage", { range, topRooms, topDevices }, fallback, aiKey(request, "top"));
      return {
        embeds: [
          baseEmbed(`Top usage: ${range}`, humanText)
            .setColor(colors.info)
            .addFields(
              { name: "Rooms", value: roomLines.join("\n") || "No room usage yet.", inline: false },
              { name: "Devices", value: deviceLines.join("\n") || "No device usage yet.", inline: false }
            )
        ]
      };
    }
  },
  {
    name: "waste",
    data: new SlashCommandBuilder()
      .setName("waste")
      .setDescription("Show off-time waste summary from backend data.")
      .addStringOption((option) => option.setName("range").setDescription("Usage range").addChoices(...rangeChoices))
      .addStringOption((option) => option.setName("room").setDescription("Optional room name or ID")),
    async execute(request, services) {
      const state = await services.backend.state();
      const query = usageQueryFromRequest(request, state);
      const usage = await services.backend.usageSummary(query);
      const humanText = await services.humanizer.generic(
        "off-time waste",
        { usage },
        `Backend-reported off-time usage for ${usage.range} is ${kwh(usage.totals.offTimeUnitKwh)} costing ${bdt(usage.totals.offTimeCostBdt)}.`,
        aiKey(request, "waste")
      );
      return {
        embeds: [
          baseEmbed(`Off-time waste: ${usage.range}`, humanText)
            .setColor(usage.totals.offTimeUnitKwh > 0 ? colors.warning : colors.success)
            .addFields(
              { name: "Off-time usage", value: kwh(usage.totals.offTimeUnitKwh), inline: true },
              { name: "Off-time cost", value: bdt(usage.totals.offTimeCostBdt), inline: true },
              { name: "Average power", value: watts(usage.totals.averagePowerWatts), inline: true }
            )
        ]
      };
    }
  },
  {
    name: "visual",
    data: new SlashCommandBuilder().setName("visual").setDescription("Post a compact text visualizer of rooms and devices."),
    async execute(request, services) {
      const state = await services.backend.state();
      const humanText = await services.humanizer.generic(
        "office visual",
        { rooms: state.rooms, devices: state.devices, alerts: state.activeAlerts },
        state.activeAlerts.length
          ? `The visual map shows ${state.activeAlerts.length} active alert(s), so check highlighted rooms first.`
          : "The visual map is clear of active alerts right now.",
        aiKey(request, "visual")
      );
      return { embeds: [visualEmbed(state, humanText)] };
    }
  },
  {
    name: "health",
    data: new SlashCommandBuilder().setName("health").setDescription("Check backend and bot health."),
    async execute(request, services) {
      const health = await services.backend.health();
      const humanText = await services.humanizer.health(health, config.BACKEND_URL, aiKey(request, "health"));
      return {
        embeds: [
          baseEmbed("Bot health", humanText)
            .setColor(colors.success)
            .addFields(
              { name: "Backend", value: health.service ?? "officepulse-backend", inline: true },
              { name: "Mongo ready state", value: String(health.mongoReadyState ?? "unavailable"), inline: true },
              { name: "Backend URL", value: config.BACKEND_URL, inline: false },
              { name: "Gemini", value: `configured: ${config.GEMINI_API_KEY ? "yes" : "no"}\nenabled: ${config.ENABLE_AI_HUMANIZATION ? "yes" : "no"}\nmodel: ${config.GEMINI_MODEL}\nfallback: ${config.AI_FALLBACK_TO_RULE_BASED ? "yes" : "no"}`, inline: false }
            )
        ]
      };
    }
  },
  {
    name: "help",
    data: new SlashCommandBuilder().setName("help").setDescription("Show command list and examples."),
    async execute(request, services) {
      const humanText = await services.humanizer.generic(
        "help",
        { requiredCommands: ["status", "room", "usage"], prefix: config.COMMAND_PREFIX },
        "Start with the three hackathon-required commands: status for the office, room for one room, and usage for electricity/cost.",
        aiKey(request, "help")
      );
      return { embeds: [helpEmbed(config.COMMAND_PREFIX, humanText)] };
    }
  },
  {
    name: "bot-config",
    aliases: ["config"],
    data: new SlashCommandBuilder()
      .setName("bot-config")
      .setDescription("Configure alert channel and bot behavior.")
      .addChannelOption((option) => option.setName("alert_channel").setDescription("Channel for proactive alerts").addChannelTypes(ChannelType.GuildText))
      .addBooleanOption((option) => option.setName("proactive_alerts").setDescription("Enable proactive alerts for this guild"))
      .addBooleanOption((option) => option.setName("ai_humanization").setDescription("Enable Gemini humanization for this guild")),
    async execute(request, services) {
      if (!request.guildId) throw new FriendlyError("This command must be used inside a Discord server.");
      if (!request.isAdmin) throw new FriendlyError("You need Manage Server permission to change bot config.");
      const alertChannelId = optionString(request, "alert_channel");
      const proactiveAlertsEnabled = optionBoolean(request, "proactive_alerts");
      const aiHumanizationEnabled = optionBoolean(request, "ai_humanization");
      const updated = await services.guildStore.update(request.guildId, {
        ...(alertChannelId ? { alertChannelId } : {}),
        ...(proactiveAlertsEnabled === undefined ? {} : { proactiveAlertsEnabled }),
        ...(aiHumanizationEnabled === undefined ? {} : { aiHumanizationEnabled })
      });
      return {
        ephemeral: true,
        embeds: [
          baseEmbed("Bot config updated")
            .setColor(colors.success)
            .addFields(
              { name: "Alert channel", value: updated.alertChannelId ? `<#${updated.alertChannelId}>` : "not set", inline: true },
              { name: "Proactive alerts", value: String(updated.proactiveAlertsEnabled), inline: true },
              { name: "AI humanization", value: String(updated.aiHumanizationEnabled), inline: true }
            )
        ]
      };
    }
  }
];

export function getCommand(name: string): CommandDefinition | undefined {
  const normalized = name.toLowerCase();
  return commandDefinitions.find((command) => command.name === normalized || command.aliases?.includes(normalized));
}

export function hasAdminPermission(permissions: bigint | null | undefined): boolean {
  if (!permissions) return false;
  return new PermissionsBitField(permissions).has(PermissionsBitField.Flags.ManageGuild);
}

function optionString(request: CommandRequest, key: string): string | undefined {
  const value = request.options[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionNumber(request: CommandRequest, key: string): number | undefined {
  const value = request.options[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionBoolean(request: CommandRequest, key: string): boolean | undefined {
  const value = request.options[key];
  return typeof value === "boolean" ? value : undefined;
}

function aiKey(request: CommandRequest, command: string): string {
  return `${request.userId}:${command}`;
}

function usageQueryFromRequest(request: CommandRequest, state: OfficeState): UsageQuery {
  const range = optionString(request, "range") ?? request.args[0] ?? "today";
  const roomQuery = optionString(request, "room");
  const deviceQuery = optionString(request, "device");
  const room = roomQuery ? requireRoom(state.rooms, roomQuery) : undefined;
  const device = deviceQuery ? requireDevice(state.devices, deviceQuery) : undefined;
  return {
    range,
    start: optionString(request, "start"),
    end: optionString(request, "end"),
    roomId: room?.roomId,
    deviceId: device?.id
  };
}

function topRoomUsage(usage: RoomUsageResponse): RoomUsageResponse["rooms"][number] | undefined {
  return [...usage.rooms].sort((a, b) => b.unitKwh - a.unitKwh)[0];
}

function topDeviceUsage(usage: DeviceUsageResponse): DeviceUsageResponse["devices"][number] | undefined {
  return [...usage.devices].sort((a, b) => b.unitKwh - a.unitKwh)[0];
}
