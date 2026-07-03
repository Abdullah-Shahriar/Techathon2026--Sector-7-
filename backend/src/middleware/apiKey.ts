import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { sendError } from "../utils/api.js";

export function requireDeviceApiKey(request: Request, response: Response, next: NextFunction): void {
  const apiKey = request.header("x-device-api-key");
  if (!apiKey || apiKey !== config.deviceApiKey) {
    sendError(response, 401, "Invalid or missing device API key");
    return;
  }

  next();
}
