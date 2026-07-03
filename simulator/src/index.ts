import { assertCatalogIntegrity } from "./deviceCatalog.js";
import { loadConfig } from "./config.js";
import { ControlServer } from "./controlServer.js";
import { Logger } from "./logger.js";
import { SimulationEngine } from "./simulationEngine.js";
import { SimulatorStateStore } from "./stateStore.js";
import { TelemetryClient } from "./telemetryClient.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);

  assertCatalogIntegrity();

  const store = new SimulatorStateStore(config.timezone);
  const telemetryClient = new TelemetryClient(config, logger);
  const engine = new SimulationEngine(config, store, telemetryClient, logger);
  const controlServer = new ControlServer({ config, store, engine, logger });

  await controlServer.start();
  engine.start();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info("Shutdown requested", { signal });
    engine.stop();
    await controlServer.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

await main();
