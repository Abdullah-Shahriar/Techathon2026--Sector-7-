import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { getVisualizerLayout, saveVisualizerLayout } from "./visualizer.service.js";

export const visualizerRouter = Router();

visualizerRouter.get("/layout", asyncHandler(async (_request, response) => {
  sendOk(response, await getVisualizerLayout());
}));

visualizerRouter.patch("/layout", asyncHandler(async (request, response) => {
  sendOk(response, await saveVisualizerLayout(request.body));
}));
