import assert from "node:assert/strict";
import test from "node:test";

process.env.DISCORD_BOT_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client";
process.env.BACKEND_URL = "http://localhost:4000";
process.env.GEMINI_MODEL = "gemini-flash-latest";

test("registers all required Discord commands", async () => {
  const { commandDefinitions } = await import("../src/commands/commandRegistry.ts");
  const names = commandDefinitions.map((command) => command.name).sort();
  assert.deepEqual(names, [
    "alerts",
    "bot-config",
    "device",
    "devices",
    "health",
    "help",
    "nodes",
    "pending",
    "room",
    "status",
    "top",
    "usage",
    "visual",
    "waste"
  ].sort());
});

test("defaults Gemini model to the latest Flash alias", async () => {
  const { config } = await import("../src/config.ts");
  assert.equal(config.GEMINI_MODEL, "gemini-flash-latest");
});

test("required commands are promoted in help output", async () => {
  const { helpEmbed } = await import("../src/messages/embeds.ts");
  const embed = helpEmbed("!").toJSON();
  const required = embed.fields?.find((field) => field.name === "Required Commands");
  assert.ok(required);
  assert.match(required.value, /!status/);
  assert.match(required.value, /!room <name>/);
  assert.match(required.value, /!usage/);
});
