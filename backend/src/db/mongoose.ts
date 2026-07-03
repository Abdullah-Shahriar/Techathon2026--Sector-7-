import mongoose from "mongoose";
import { config } from "../config.js";
import { logger } from "../logger.js";

export async function connectMongo(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const connection = await mongoose.connect(config.mongodbUri);
  logger.info({ mongodbUri: redactMongoUri(config.mongodbUri) }, "Connected to MongoDB");
  return connection;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

function redactMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return uri;
  }
}
