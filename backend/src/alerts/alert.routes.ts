import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import {
  acknowledgeAlert,
  listAlerts,
  listAlertSettings,
  resolveAlert,
  updateAlertSettings
} from "./alert.service.js";

export const alertRouter = Router();

alertRouter.get("/", asyncHandler(async (request, response) => {
  sendOk(response, await listAlerts(typeof request.query.status === "string" ? request.query.status : undefined));
}));

alertRouter.get("/settings", asyncHandler(async (_request, response) => {
  sendOk(response, await listAlertSettings());
}));

alertRouter.patch("/:id/acknowledge", asyncHandler(async (request, response) => {
  const alert = await acknowledgeAlert(request.params.id);
  if (!alert) {
    throw new Error("Alert not found");
  }
  sendOk(response, alert);
}));

alertRouter.patch("/:id/resolve", asyncHandler(async (request, response) => {
  const alert = await resolveAlert(request.params.id);
  if (!alert) {
    throw new Error("Alert not found");
  }
  sendOk(response, alert);
}));

alertRouter.patch("/settings", asyncHandler(async (request, response) => {
  sendOk(response, await updateAlertSettings(request.body));
}));
