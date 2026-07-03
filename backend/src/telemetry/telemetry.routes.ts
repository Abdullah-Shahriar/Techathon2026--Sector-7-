import { Router } from "express";
import { requireDeviceApiKey } from "../middleware/apiKey.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { ingestTelemetry, storeInvalidTelemetry } from "./telemetry.service.js";
import { telemetryPayloadSchema } from "./telemetry.schema.js";

export const telemetryRouter = Router();

telemetryRouter.post("/", requireDeviceApiKey, asyncHandler(async (request, response) => {
  const parsed = telemetryPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    await storeInvalidTelemetry(request.body, parsed.error.message);
    response.status(400).json({
      ok: false,
      error: {
        message: "Invalid telemetry payload",
        details: parsed.error.flatten()
      }
    });
    return;
  }

  const result = await ingestTelemetry(parsed.data, request.header("x-device-api-key") ?? "");
  sendOk(response, result, 202);
}));
