import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendOk } from "../utils/api.js";
import { getOfficeState } from "./state.service.js";

export const stateRouter = Router();

stateRouter.get("/", asyncHandler(async (_request, response) => {
  sendOk(response, await getOfficeState());
}));
