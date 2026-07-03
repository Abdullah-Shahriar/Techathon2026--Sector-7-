import { Router } from "express";
import mongoose from "mongoose";
import { config } from "../config.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";

export const healthRouter = Router();

healthRouter.get("/health", asyncHandler(async (_request, response) => {
  sendOk(response, {
    service: "officepulse-backend",
    mongoReadyState: mongoose.connection.readyState,
    port: config.port
  });
}));
