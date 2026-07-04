import {
  ApplicationCommandOptionType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionsBitField,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction
} from "discord.js";
import { BackendClient } from "./backend/backendClient.js";
import { Humanizer } from "./ai/humanizer.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { commandDefinitions, getCommand, type CommandRequest, type CommandServices } from "./commands/commandRegistry.js";
import { handlePrefixCommand } from "./commands/prefix/prefixRouter.js";
import { GuildConfigStore } from "./storage/guildConfigStore.js";
import { startProactiveAlerts } from "./realtime/proactiveAlerts.js";
import { userFacingError } from "./utils/errors.js";
import { CooldownStore } from "./utils/rateLimit.js";
import { cleanUserArgument, compactKey, deviceDisplayName, roomDisplayName } from "./utils/matching.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const services: CommandServices = {
  backend: new BackendClient(),
  humanizer: new Humanizer(),
  guildStore: new GuildConfigStore()
};

const cooldowns = new CooldownStore(config.COMMAND_COOLDOWN_SECONDS * 1000);

client.once(Events.ClientReady, () => {
  logger.info({
    user: client.user?.tag,
    commands: commandDefinitions.length,
    backendUrl: config.BACKEND_URL,
    geminiModel: config.GEMINI_MODEL
  }, "OfficePulse Discord bot ready");
  startProactiveAlerts({ client, backend: services.backend, humanizer: services.humanizer, guildStore: services.guildStore });
});

client.on("interactionCreate", (interaction) => {
  if (!config.ENABLE_SLASH_COMMANDS) return;
  if (interaction.isAutocomplete()) {
    void handleAutocomplete(interaction);
    return;
  }
  if (interaction.isChatInputCommand()) {
    void handleSlashCommand(interaction);
  }
});

client.on("messageCreate", (message) => {
  void handlePrefixCommand(message, services);
});

async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = getCommand(interaction.commandName);
  if (!command) return;

  const wait = cooldowns.check(`${interaction.user.id}:${interaction.commandName}`);
  if (wait > 0) {
    await interaction.reply({ content: `Please wait ${wait}s before using another OfficePulse command.`, flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    if (command.name === "bot-config") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } else {
      await interaction.deferReply();
    }
    const request: CommandRequest = {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      args: [],
      options: slashOptions(interaction),
      isAdmin: Boolean(interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild))
    };
    const result = await command.execute(request, services);
    await interaction.editReply({ content: result.content, embeds: result.embeds });
  } catch (error) {
    const message = userFacingError(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, embeds: [] }).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (!["room", "device"].includes(focused.name)) {
    await interaction.respond([]).catch(() => undefined);
    return;
  }

  try {
    const state = await services.backend.state();
    const query = compactKey(cleanUserArgument(String(focused.value ?? "")));
    if (focused.name === "room") {
      const choices = state.rooms
        .filter((room) => {
          const label = roomDisplayName(room);
          return !query || compactKey(label).includes(query) || compactKey(room.roomId).includes(query);
        })
        .slice(0, 25)
        .map((room) => ({ name: roomDisplayName(room), value: room.roomId }));
      await interaction.respond(choices);
      return;
    }

    const choices = state.devices
      .filter((device) => {
        const label = deviceDisplayName(device);
        return !query || compactKey(label).includes(query) || compactKey(device.externalDeviceId).includes(query);
      })
      .slice(0, 25)
      .map((device) => ({ name: `${deviceDisplayName(device)} (${device.externalDeviceId})`, value: device.id }));
    await interaction.respond(choices);
  } catch {
    await interaction.respond([]).catch(() => undefined);
  }
}

function slashOptions(interaction: ChatInputCommandInteraction): CommandRequest["options"] {
  const options: CommandRequest["options"] = {};
  for (const option of interaction.options.data) {
    if (option.type === ApplicationCommandOptionType.Channel) {
      options[option.name] = option.channel?.id ?? String(option.value ?? "");
      continue;
    }
    options[option.name] = option.value as string | number | boolean | null | undefined;
  }
  return options;
}

process.on("unhandledRejection", (error) => {
  logger.error({ error: error instanceof Error ? error.message : String(error) }, "Unhandled rejection");
});

await services.guildStore.load();
await client.login(config.DISCORD_BOT_TOKEN);
