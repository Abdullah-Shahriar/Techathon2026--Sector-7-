import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../logger.js";
import { sendError } from "../utils/api.js";

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response, next).catch(next);
  };
}

export function notFoundHandler(request: Request, response: Response): void {
  sendError(response, 404, `Route not found: ${request.method} ${request.path}`);
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    sendError(response, 400, "Validation failed", error.flatten());
    return;
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  const status = message.includes("not found") || message.includes("not found") ? 404 : 500;
  if (status >= 500) {
    logger.error({ error }, "Unhandled request error");
  }
  sendError(response, status, message);
}
