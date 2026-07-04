import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { archiveRoom, createRoom, deactivateRoom, getRoom, listRooms, restoreRoom, updateRoom } from "./room.service.js";

export const roomRouter = Router();

roomRouter.get("/", asyncHandler(async (_request, response) => {
  sendOk(response, await listRooms({ includeInactive: _request.query.includeInactive === "true" }));
}));

roomRouter.post("/", asyncHandler(async (request, response) => {
  sendOk(response, await createRoom(request.body), 201);
}));

roomRouter.get("/:id", asyncHandler(async (request, response) => {
  const room = await getRoom(request.params.id);
  if (!room) {
    throw new Error("Room not found");
  }
  sendOk(response, room);
}));

roomRouter.patch("/:id", asyncHandler(async (request, response) => {
  const room = await updateRoom(request.params.id, request.body);
  if (!room) {
    throw new Error("Room not found");
  }
  sendOk(response, room);
}));

roomRouter.delete("/:id", asyncHandler(async (request, response) => {
  const room = await deactivateRoom(request.params.id);
  if (!room) {
    throw new Error("Room not found");
  }
  sendOk(response, room);
}));

roomRouter.post("/:id/archive", asyncHandler(async (request, response) => {
  const room = await archiveRoom(request.params.id);
  if (!room) {
    throw new Error("Room not found");
  }
  sendOk(response, room);
}));

roomRouter.post("/:id/restore", asyncHandler(async (request, response) => {
  const room = await restoreRoom(request.params.id);
  if (!room) {
    throw new Error("Room not found");
  }
  sendOk(response, room);
}));
