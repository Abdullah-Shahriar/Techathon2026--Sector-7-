import { z } from "zod";
import { AuditLog } from "../models/index.js";

export const auditQuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200)
});

export interface AuditLogInput {
  action: string;
  resourceType: string;
  resourceId?: unknown;
  actor?: string;
  dataJson?: Record<string, unknown>;
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  await AuditLog.create({
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ? String(input.resourceId) : null,
    actor: input.actor ?? "system",
    dataJson: input.dataJson ?? {},
    createdAt: new Date()
  });
}

export async function listAuditLogs(query: unknown = {}): Promise<unknown[]> {
  const parsed = auditQuerySchema.parse(query);
  const filter: Record<string, unknown> = {};
  if (parsed.action) {
    filter.action = parsed.action;
  }
  if (parsed.resourceType) {
    filter.resourceType = parsed.resourceType;
  }
  if (parsed.resourceId) {
    filter.resourceId = parsed.resourceId;
  }

  return AuditLog.find(filter).sort({ createdAt: -1 }).limit(parsed.limit).lean();
}
