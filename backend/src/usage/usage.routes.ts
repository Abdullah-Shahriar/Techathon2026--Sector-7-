import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { getDeviceUsage, getRoomUsage, getTimeline, getUsageSummary } from "./usage.service.js";

export const usageRouter = Router();

usageRouter.get("/summary", asyncHandler(async (request, response) => {
  sendOk(response, await getUsageSummary(request.query));
}));

usageRouter.get("/rooms", asyncHandler(async (request, response) => {
  sendOk(response, await getRoomUsage(request.query));
}));

usageRouter.get("/devices", asyncHandler(async (request, response) => {
  sendOk(response, await getDeviceUsage(request.query));
}));

usageRouter.get("/timeline", asyncHandler(async (request, response) => {
  sendOk(response, await getTimeline(request.query));
}));
