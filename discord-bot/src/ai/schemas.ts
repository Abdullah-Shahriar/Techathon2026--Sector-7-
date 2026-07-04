import { z } from "zod";

export const humanizedTextSchema = z.string().trim().min(1).max(900);

export type HumanizedText = z.infer<typeof humanizedTextSchema>;
