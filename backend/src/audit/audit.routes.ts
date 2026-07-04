import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { listAuditLogs } from "./audit.service.js";

export const auditRouter = Router();

auditRouter.get("/", asyncHandler(async (request, response) => {
  sendOk(response, await listAuditLogs(request.query));
}));
