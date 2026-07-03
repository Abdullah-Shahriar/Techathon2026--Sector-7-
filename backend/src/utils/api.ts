import type { Response } from "express";

export function sendOk<T>(response: Response, data: T, status = 200): void {
  response.status(status).json({ ok: true, data });
}

export function sendError(response: Response, status: number, message: string, details?: unknown): void {
  response.status(status).json({
    ok: false,
    error: {
      message,
      details
    }
  });
}
