import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { getDevice, listDevices, updateDevice } from "./device.service.js";

export const deviceRouter = Router();

deviceRouter.get("/", asyncHandler(async (_request, response) => {
  sendOk(response, await listDevices());
}));

deviceRouter.get("/:id", asyncHandler(async (request, response) => {
  const device = await getDevice(request.params.id);
  if (!device) {
    throw new Error("Device not found");
  }
  sendOk(response, device);
}));

deviceRouter.patch("/:id", asyncHandler(async (request, response) => {
  const device = await updateDevice(request.params.id, request.body);
  if (!device) {
    throw new Error("Device not found");
  }
  sendOk(response, device);
}));
