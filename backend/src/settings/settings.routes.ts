import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { getSettings, updateSettings } from "./settings.service.js";

export const settingsRouter = Router();

settingsRouter.get("/", asyncHandler(async (_request, response) => {
  sendOk(response, await getSettings());
}));

settingsRouter.patch("/", asyncHandler(async (request, response) => {
  sendOk(response, await updateSettings(request.body));
}));
