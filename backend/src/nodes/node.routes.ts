import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { assignNodeToRoom, createRoomFromNode, ignoreNode, listNodes, listPendingNodes } from "./node.service.js";

export const nodeRouter = Router();

nodeRouter.get("/", asyncHandler(async (_request, response) => {
  sendOk(response, await listNodes());
}));

nodeRouter.get("/pending", asyncHandler(async (_request, response) => {
  sendOk(response, await listPendingNodes());
}));

nodeRouter.post("/:nodeId/assign-room", asyncHandler(async (request, response) => {
  sendOk(response, await assignNodeToRoom(request.params.nodeId, request.body));
}));

nodeRouter.post("/:nodeId/create-room", asyncHandler(async (request, response) => {
  sendOk(response, await createRoomFromNode(request.params.nodeId, request.body), 201);
}));

nodeRouter.post("/:nodeId/ignore", asyncHandler(async (request, response) => {
  sendOk(response, await ignoreNode(request.params.nodeId));
}));
