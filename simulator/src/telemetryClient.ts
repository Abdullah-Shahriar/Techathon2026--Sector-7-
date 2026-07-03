import type { Logger } from "./logger.js";
import type { SendResult, SimulatorConfig, TelemetryPayload } from "./types.js";

export class TelemetryClient {
  constructor(
    private readonly config: SimulatorConfig,
    private readonly logger: Logger
  ) {}

  async sendPayload(payload: TelemetryPayload, roomId: string): Promise<SendResult> {
    if (this.config.dryRun) {
      this.logger.info("DRY_RUN telemetry payload", payload);
      return {
        ok: true,
        dryRun: true,
        status: 0,
        nodeId: payload.nodeId,
        roomId,
        sequence: payload.sequence
      };
    }

    try {
      const response = await fetch(this.config.telemetryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-api-key": this.config.deviceApiKey
        },
        body: JSON.stringify(payload)
      });

      const result: SendResult = {
        ok: response.ok,
        dryRun: false,
        status: response.status,
        statusText: response.statusText,
        nodeId: payload.nodeId,
        roomId,
        sequence: payload.sequence
      };

      if (response.ok) {
        this.logger.debug("Telemetry delivered", result);
      } else {
        this.logger.warn("Telemetry delivery failed", result);
      }

      return result;
    } catch (error) {
      const result: SendResult = {
        ok: false,
        dryRun: false,
        error: error instanceof Error ? error.message : String(error),
        nodeId: payload.nodeId,
        roomId,
        sequence: payload.sequence
      };

      this.logger.error("Telemetry delivery error", result);
      return result;
    }
  }

  async sendBatch(payloads: Array<{ payload: TelemetryPayload; roomId: string }>): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const item of payloads) {
      results.push(await this.sendPayload(item.payload, item.roomId));
    }

    return results;
  }
}
