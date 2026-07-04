import { logger } from "../logger.js";
import type { AlertSummary, DeviceSummary, DeviceUsageResponse, HealthResponse, NodeSummary, OfficeState, RoomSummary, RoomUsageResponse, UsageSummaryResponse } from "../backend/backendTypes.js";
import { bdt, dateTime, duration, kwh, roomLabel, statusEmoji, watts } from "../utils/format.js";
import { GeminiClient } from "./geminiClient.js";

export class Humanizer {
  constructor(private readonly gemini = new GeminiClient()) {}

  async officeStatus(state: OfficeState, usage?: UsageSummaryResponse, cooldownKey?: string): Promise<string> {
    const onDevices = state.devices.filter((device) => device.status === "on").length;
    const onlineNodes = state.nodes.filter((node) => isOnlineNode(node.status)).length;
    const alertText = state.activeAlerts.length
      ? `${state.activeAlerts.length} active alert(s) need attention.`
      : "No active alerts are showing right now.";
    const fallback = [
      `The office is drawing ${watts(state.officeSummary.currentPowerWatts)} right now, with ${onDevices}/${state.devices.length} devices on across ${state.rooms.length} room(s).`,
      `Today stands at ${kwh(state.officeSummary.unitKwhToday)} and ${bdt(state.officeSummary.costBdtToday)}; month-to-date is ${bdt(state.officeSummary.costBdtThisMonth)}.`,
      alertText,
      `${onlineNodes}/${state.nodes.length} ESP32 node(s) are online, with ${state.pendingNodes.length} pending.`
    ].join(" ");
    return await this.aiOrFallback("office status", { officeSummary: state.officeSummary, alerts: state.activeAlerts, nodes: state.nodes, usage }, fallback, cooldownKey);
  }

  async roomStatus(room: RoomSummary, devices: DeviceSummary[], alerts: AlertSummary[], cooldownKey?: string): Promise<string> {
    const onDevices = devices.filter((device) => device.status === "on").length;
    const deviceText = devices.length
      ? `${onDevices}/${devices.length} assigned device(s) are on.`
      : "No devices are assigned to this room yet.";
    const fallback = [
      `${room.name} is using ${watts(room.currentPowerWatts)} right now.`,
      deviceText,
      `Today it has used ${kwh(room.unitKwhToday)} costing ${bdt(room.costBdtToday)}.`,
      alerts.length ? `${alerts.length} active alert(s) need attention.` : "No active room alerts."
    ].join(" ");
    return await this.aiOrFallback("room status", { room, devices, alerts }, fallback, cooldownKey);
  }

  async usageSummary(
    usage: UsageSummaryResponse,
    rooms: RoomSummary[],
    devices: DeviceSummary[],
    cooldownKey?: string,
    topRoom?: RoomUsageResponse["rooms"][number],
    topDevice?: DeviceUsageResponse["devices"][number]
  ): Promise<string> {
    const topRoomName = topRoom ? roomLabel(rooms.find((room) => room.roomId === topRoom.roomId), topRoom.roomId) : undefined;
    const topDeviceName = topDevice ? devices.find((device) => device.id === topDevice.deviceId)?.name ?? topDevice.deviceId : undefined;
    const fallback = [
      `For ${usage.range}, the office has used ${kwh(usage.totals.unitKwh)} costing ${bdt(usage.totals.costBdt)}.`,
      `Office-time usage is ${kwh(usage.totals.officeTimeUnitKwh)}, while off-time usage is ${kwh(usage.totals.offTimeUnitKwh)}.`,
      topRoom ? `The highest room is ${topRoomName} at ${kwh(topRoom.unitKwh)}.` : "",
      topDevice ? `The highest device is ${topDeviceName} at ${kwh(topDevice.unitKwh)}.` : ""
    ].filter(Boolean).join(" ");
    return await this.aiOrFallback("usage summary", { usage, rooms, devices, topRoom, topDevice }, fallback, cooldownKey);
  }

  async generic(kind: string, data: unknown, fallback: string, cooldownKey?: string): Promise<string> {
    return await this.aiOrFallback(kind, data, fallback, cooldownKey);
  }

  async health(health: HealthResponse, backendUrl: string, cooldownKey?: string): Promise<string> {
    const fallback = `The bot is online and the backend responded as ${health.service ?? "officepulse-backend"}. Mongo ready state is ${health.mongoReadyState ?? "unavailable"}.`;
    return await this.aiOrFallback("bot health", { health, backendUrl }, fallback, cooldownKey);
  }

  async deviceStatus(device: DeviceSummary, room?: RoomSummary, alerts: AlertSummary[] = [], cooldownKey?: string): Promise<string> {
    const fallback = [
      `${statusEmoji(device.status)} ${device.name} is ${device.status.toUpperCase()} in ${roomLabel(room, device.roomId)}.`,
      `Current backend load is ${watts(device.powerWatts)} at ${device.voltageVolts}V and ${device.currentAmps}A.`,
      `Today it has used ${kwh(device.unitKwhToday)} costing ${bdt(device.costBdtToday)}.`,
      `On duration is ${duration(device.onDurationSeconds)}.`,
      alerts.length ? `${alerts.length} active device alert(s) are attached.` : "No active device alerts."
    ].join(" ");
    return await this.aiOrFallback("device status", { device, room, alerts }, fallback, cooldownKey);
  }

  async alert(alert: AlertSummary, cooldownKey?: string): Promise<string> {
    const fallback = `${alert.title}: ${alert.message} Severity: ${alert.severity}. Created ${dateTime(alert.createdAt)}.`;
    return await this.aiOrFallback("alert", alert, fallback, cooldownKey);
  }

  async alerts(alerts: AlertSummary[], cooldownKey?: string): Promise<string> {
    const fallback = alerts.length
      ? `${alerts.length} alert(s) found. Highest attention: ${alerts[0]?.title ?? "unavailable"}.`
      : "No alerts found for this view.";
    return await this.aiOrFallback("alerts list", alerts, fallback, cooldownKey);
  }

  async nodes(nodes: NodeSummary[], pending: NodeSummary[], cooldownKey?: string): Promise<string> {
    const online = nodes.filter((node) => isOnlineNode(node.status)).length;
    const fallback = `${online}/${nodes.length} ESP32 node(s) are online. ${pending.length} pending node(s) still need assignment.`;
    return await this.aiOrFallback("node health", { nodes, pending }, fallback, cooldownKey);
  }

  private async aiOrFallback(kind: string, data: unknown, fallback: string, cooldownKey = kind): Promise<string> {
    const text = await this.gemini.humanize(kind, data, cooldownKey);
    if (text) return text;
    logger.debug({ kind }, "Rule-based humanization fallback used");
    return fallback;
  }
}

function isOnlineNode(status: string): boolean {
  return status === "active" || status === "online";
}
