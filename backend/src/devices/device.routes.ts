import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { archiveDevice, getDevice, listDevices, moveDeviceToRoom, restoreDevice, updateDevice } from "./device.service.js";

export const deviceRouter = Router();

deviceRouter.get("/", asyncHandler(async (request, response) => {
  sendOk(response, await listDevices({ includeInactive: request.query.includeInactive === "true" }));
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

deviceRouter.post("/:id/move-room", asyncHandler(async (request, response) => {
  const device = await moveDeviceToRoom(request.params.id, request.body);
  if (!device) {
    throw new Error("Device not found");
  }
  sendOk(response, device);
}));

deviceRouter.post("/:id/archive", asyncHandler(async (request, response) => {
  const device = await archiveDevice(request.params.id);
  if (!device) {
    throw new Error("Device not found");
  }
  sendOk(response, device);
}));

deviceRouter.post("/:id/restore", asyncHandler(async (request, response) => {
  const device = await restoreDevice(request.params.id);
  if (!device) {
    throw new Error("Device not found");
  }
  sendOk(response, device);
}));
