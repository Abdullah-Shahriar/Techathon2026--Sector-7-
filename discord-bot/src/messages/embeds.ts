import { EmbedBuilder, type APIEmbedField } from "discord.js";
import type { AlertSummary, DeviceSummary, NodeSummary, OfficeState, RoomSummary, UsageSummaryResponse } from "../backend/backendTypes.js";
import { amps, bdt, dateTime, deviceLabel, duration, kwh, roomLabel, statusEmoji, truncate, watts } from "../utils/format.js";

export const colors = {
  success: 0x2ecc71,
  info: 0x3498db,
  warning: 0xf1c40f,
  critical: 0xe74c3c,
  neutral: 0x95a5a6
};

export function baseEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description ? truncate(description, 4000) : null)
    .setTimestamp(new Date())
    .setFooter({ text: "OfficePulse backend data" });
}

export function officeStatusEmbed(state: OfficeState, humanText: string): EmbedBuilder {
  const summary = state.officeSummary;
  return baseEmbed("Office status", humanText)
    .setColor(state.activeAlerts.length ? colors.warning : colors.success)
    .addFields(
      { name: "Current power", value: watts(summary.currentPowerWatts), inline: true },
      { name: "Today", value: `${kwh(summary.unitKwhToday)}\n${bdt(summary.costBdtToday)}`, inline: true },
      { name: "Month to date", value: `${kwh(summary.unitKwhThisMonth)}\n${bdt(summary.costBdtThisMonth)}`, inline: true },
      { name: "Rooms/devices", value: `${state.rooms.length} rooms\n${state.devices.filter((device) => device.status === "on").length}/${state.devices.length} devices on`, inline: true },
      { name: "Nodes", value: `${state.nodes.filter((node) => isOnlineNode(node.status)).length}/${state.nodes.length} online\n${state.pendingNodes.length} pending`, inline: true },
      { name: "Alerts", value: `${state.activeAlerts.length} active`, inline: true }
    );
}

export function roomStatusEmbed(room: RoomSummary, devices: DeviceSummary[], alerts: AlertSummary[], humanText: string): EmbedBuilder {
  return baseEmbed(`Room status: ${room.name}`, humanText)
    .setColor(alerts.length ? colors.warning : colors.info)
    .addFields(
      { name: "Power", value: `${watts(room.currentPowerWatts)}\n${amps(room.approxCurrentAmps)}`, inline: true },
      { name: "Today", value: `${kwh(room.unitKwhToday)}\n${bdt(room.costBdtToday)}`, inline: true },
      { name: "Devices", value: `${devices.filter((device) => device.status === "on").length}/${devices.length} on`, inline: true },
      { name: "Device list", value: truncate(devices.map(deviceLabel).join("\n") || "No devices assigned."), inline: false },
      { name: "Alerts", value: alerts.map((alert) => `${severityEmoji(alert.severity)} ${alert.title}`).join("\n") || "No active room alerts.", inline: false }
    );
}

export function usageEmbed(usage: UsageSummaryResponse, humanText: string): EmbedBuilder {
  return baseEmbed(`Usage: ${usage.range}`, humanText)
    .setColor(colors.info)
    .addFields(
      { name: "Total", value: `${kwh(usage.totals.unitKwh)}\n${bdt(usage.totals.costBdt)}`, inline: true },
      { name: "Office time", value: `${kwh(usage.totals.officeTimeUnitKwh)}\n${bdt(usage.totals.officeTimeCostBdt)}`, inline: true },
      { name: "Off time", value: `${kwh(usage.totals.offTimeUnitKwh)}\n${bdt(usage.totals.offTimeCostBdt)}`, inline: true },
      { name: "Range", value: `${dateTime(usage.start)} to ${dateTime(usage.end)}`, inline: false }
    );
}

export function alertEmbed(alert: AlertSummary, humanText?: string): EmbedBuilder {
  return baseEmbed(alert.title, humanText ?? alert.message)
    .setColor(alert.severity === "critical" ? colors.critical : alert.severity === "warning" ? colors.warning : colors.info)
    .addFields(
      { name: "Severity", value: `${severityEmoji(alert.severity)} ${alert.severity}`, inline: true },
      { name: "Status", value: alert.status, inline: true },
      { name: "Scope", value: alert.scope, inline: true },
      { name: "Room/device/node", value: [alert.roomId, alert.deviceId, alert.nodeId].filter(Boolean).join(" / ") || "global", inline: false },
      { name: "Created", value: dateTime(alert.createdAt), inline: true },
      { name: "Occurrences", value: String(alert.occurrences?.length ?? 0), inline: true }
    );
}

export function alertsListEmbed(alerts: AlertSummary[], humanText: string, title = "Alerts"): EmbedBuilder {
  const fields = alerts.slice(0, 10).map((alert): APIEmbedField => ({
    name: `${severityEmoji(alert.severity)} ${alert.title}`,
    value: truncate(`${alert.message}\n${alert.roomId ?? alert.deviceId ?? alert.nodeId ?? "global"} • ${dateTime(alert.createdAt)}`, 1024),
    inline: false
  }));
  return baseEmbed(title, humanText)
    .setColor(alerts.length ? colors.warning : colors.success)
    .addFields(fields.length ? fields : [{ name: "Clear", value: "No alerts found.", inline: false }]);
}

export function deviceEmbed(device: DeviceSummary, room: RoomSummary | undefined, alerts: AlertSummary[], description: string): EmbedBuilder {
  return baseEmbed(device.name, description)
    .setColor(device.status === "on" ? colors.success : colors.neutral)
    .addFields(
      { name: "Status", value: `${statusEmoji(device.status)} ${device.status}`, inline: true },
      { name: "Room", value: roomLabel(room, device.roomId), inline: true },
      { name: "Power", value: `${watts(device.powerWatts)}\n${device.voltageVolts}V / ${device.currentAmps}A`, inline: true },
      { name: "Today", value: `${kwh(device.unitKwhToday)}\n${bdt(device.costBdtToday)}`, inline: true },
      { name: "Timing", value: `Changed: ${dateTime(device.lastChangedAt)}\nOn since: ${dateTime(device.onSince)}\nDuration: ${duration(device.onDurationSeconds)}`, inline: false },
      { name: "Alerts", value: alerts.map((alert) => `${severityEmoji(alert.severity)} ${alert.title}`).join("\n") || "No active device alerts.", inline: false }
    );
}

export function devicesEmbed(devices: DeviceSummary[], rooms: RoomSummary[], title = "Devices", humanText?: string): EmbedBuilder {
  const grouped = devices.slice(0, 20).map((device) => {
    const room = rooms.find((item) => item.roomId === device.roomId);
    return `${deviceLabel(device)} • ${roomLabel(room, device.roomId)} • ${watts(device.powerWatts)}`;
  });
  const body = [humanText, grouped.length ? truncate(grouped.join("\n"), 3000) : "No devices found."].filter(Boolean).join("\n\n");
  return baseEmbed(title, body)
    .setColor(colors.info);
}

export function nodesEmbed(nodes: NodeSummary[], pending: NodeSummary[], description: string): EmbedBuilder {
  return baseEmbed("ESP32 nodes", description)
    .setColor(pending.length ? colors.warning : colors.success)
    .addFields(
      { name: "Known nodes", value: nodes.map(nodeLine).join("\n") || "No nodes discovered.", inline: false },
      { name: "Pending nodes", value: pending.map(nodeLine).join("\n") || "No pending nodes.", inline: false }
    );
}

export function visualEmbed(state: OfficeState, humanText?: string): EmbedBuilder {
  const lines = state.rooms.map((room) => {
    const devices = state.devices.filter((device) => device.roomId === room.roomId);
    const deviceIcons = devices.map((device) => `${device.type === "fan" ? "F" : "L"}:${device.status === "on" ? "ON" : "off"}`).join(" ");
    const alerts = state.activeAlerts.filter((alert) => alert.roomId === room.roomId || devices.some((device) => device.id === alert.deviceId));
    return `**${room.name}** ${watts(room.currentPowerWatts)} ${alerts.length ? "ALERT" : "OK"}\n${deviceIcons}`;
  });
  return baseEmbed("Office visual", [humanText, lines.join("\n\n")].filter(Boolean).join("\n\n"))
    .setColor(state.activeAlerts.length ? colors.warning : colors.success);
}

export function helpEmbed(prefix: string, humanText = "Start with the three hackathon-required commands below. They are the fastest way to explain the live office state, a room, and usage/cost."): EmbedBuilder {
  return baseEmbed("OfficePulse bot commands", humanText)
    .setColor(colors.info)
    .addFields(
      { name: "Required Commands", value: [
        "`/status` or `" + prefix + "status` - current whole-office status",
        "`/room room:<name>` or `" + prefix + "room <name>` - current room status",
        "`/usage` or `" + prefix + "usage` - electricity usage and cost"
      ].join("\n"), inline: false },
      { name: "Extra Commands", value: [
        "`/alerts` or `" + prefix + "alerts`",
        "`/devices`, `/device`, `/nodes`, `/pending`",
        "`/top`, `/waste`, `/visual`, `/health`, `/bot-config`"
      ].join("\n"), inline: false }
    );
}

function nodeLine(node: NodeSummary): string {
  return `${statusEmoji(node.status)} ${node.nodeId} • ${node.status} • room ${node.roomId ?? "unassigned"} • seq ${node.lastSequence ?? "n/a"} • seen ${dateTime(node.lastSeenAt)}`;
}

function severityEmoji(severity: string): string {
  if (severity === "critical") return "🔴";
  if (severity === "warning") return "🟡";
  if (severity === "info") return "🔵";
  return "⚪";
}

function isOnlineNode(status: string): boolean {
  return status === "active" || status === "online";
}
