import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { commandDefinitions } from "./commandRegistry.js";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_BOT_TOKEN);
const commands = commandDefinitions.map((command) => command.data.toJSON());

if (!config.ENABLE_SLASH_COMMANDS) {
  logger.info("Slash commands are disabled; skipping registration");
  process.exit(0);
}

if (config.DISCORD_GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: commands }
  );
  logger.info({ guildId: config.DISCORD_GUILD_ID, count: commands.length }, "Registered guild slash commands");
} else {
  await rest.put(
    Routes.applicationCommands(config.DISCORD_CLIENT_ID),
    { body: commands }
  );
  logger.info({ count: commands.length }, "Registered global slash commands");
}
