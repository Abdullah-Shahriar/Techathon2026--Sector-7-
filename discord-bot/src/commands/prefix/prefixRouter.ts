import type { Message } from "discord.js";
import { config } from "../../config.js";
import type { CommandServices } from "../commandRegistry.js";
import { getCommand } from "../commandRegistry.js";
import { userFacingError } from "../../utils/errors.js";
import { cleanUserArgument } from "../../utils/matching.js";

export async function handlePrefixCommand(message: Message, services: CommandServices): Promise<void> {
  if (!config.ENABLE_PREFIX_COMMANDS || message.author.bot || !message.content.startsWith(config.COMMAND_PREFIX)) return;

  const raw = message.content.slice(config.COMMAND_PREFIX.length).trim();
  if (!raw) return;

  const { name, args, rest } = parsePrefix(raw);
  const command = name ? getCommand(name) : undefined;
  if (!command) return;

  try {
    const result = await command.execute({
      userId: message.author.id,
      guildId: message.guildId,
      args,
      options: prefixOptions(command.name, args, rest),
      isAdmin: Boolean(message.member?.permissions.has("ManageGuild"))
    }, services);
    await message.reply({ content: result.content, embeds: result.embeds });
  } catch (error) {
    await message.reply({ content: userFacingError(error) });
  }
}

export function parsePrefix(raw: string): { name: string; args: string[]; rest: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const name = match?.[1]?.toLowerCase() ?? "";
  const rest = cleanUserArgument(match?.[2] ?? "");
  const args = rest ? rest.split(/\s+/) : [];
  return { name, args, rest };
}

function prefixOptions(commandName: string, args: string[], rest: string): Record<string, string | number | boolean | null | undefined> {
  if (commandName === "room") return { room: rest };
  if (commandName === "device") return { device: rest };
  if (commandName === "devices") return { room: rest };
  if (commandName === "usage" || commandName === "top" || commandName === "waste") return usagePrefixOptions(args);
  if (commandName === "alerts") return { status: cleanUserArgument(args[0]), severity: cleanUserArgument(args[1]) };
  return {};
}

function usagePrefixOptions(args: string[]): Record<string, string | undefined> {
  const normalized = args.map((arg) => cleanUserArgument(arg));
  const markerIndex = normalized.findIndex((arg) => ["room", "device"].includes(arg.toLowerCase()));
  if (markerIndex >= 0) {
    const marker = normalized[markerIndex]?.toLowerCase();
    const value = cleanUserArgument(normalized.slice(markerIndex + 1).join(" "));
    return {
      range: markerIndex > 0 ? normalized[0] : undefined,
      room: marker === "room" ? value : undefined,
      device: marker === "device" ? value : undefined
    };
  }

  return { range: cleanUserArgument(normalized[0]) };
}
