import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { CooldownStore } from "../utils/rateLimit.js";
import { HUMANIZER_SYSTEM_PROMPT, buildHumanizerPrompt } from "./prompts.js";
import { humanizedTextSchema } from "./schemas.js";

export class GeminiClient {
  private readonly ai: GoogleGenAI | null;
  private readonly cooldown = new CooldownStore(config.AI_COOLDOWN_SECONDS * 1000);
  private quotaBlockedUntil = 0;

  constructor(
    private readonly apiKey = config.GEMINI_API_KEY,
    private readonly model = config.GEMINI_MODEL
  ) {
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  get enabled(): boolean {
    return Boolean(this.ai && config.ENABLE_AI_HUMANIZATION);
  }

  async humanize(kind: string, data: unknown, cooldownKey = "global"): Promise<string | null> {
    if (!this.enabled || !this.ai) return null;
    if (Date.now() < this.quotaBlockedUntil) return null;
    if (this.cooldown.check(cooldownKey) > 0) return null;

    const prompt = buildHumanizerPrompt(kind, data);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await withTimeout(
          this.ai.models.generateContent({
            model: this.model,
            contents: prompt,
            config: {
              systemInstruction: HUMANIZER_SYSTEM_PROMPT,
              temperature: 0.4,
              maxOutputTokens: 220
            }
          }),
          8000
        );
        const text = humanizedTextSchema.parse(response.text?.trim());
        if (isWeakHumanization(text)) {
          logger.debug({ kind, model: this.model }, "Gemini humanization rejected as weak");
          return null;
        }
        logger.debug({ kind, model: this.model }, "Gemini humanization used");
        return text;
      } catch (error) {
        if (isQuotaError(error)) {
          this.quotaBlockedUntil = Date.now() + 60_000;
          logger.warn({ error: summarizeGeminiError(error), model: this.model, retryAfterSeconds: 60 }, "Gemini quota backoff enabled");
          return null;
        }
        if (attempt === 2) {
          logger.warn({ error: summarizeGeminiError(error), model: this.model }, "Gemini humanization failed");
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|quota|resource_exhausted/i.test(message);
}

function summarizeGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|quota|resource_exhausted/i.test(message)) return "Gemini quota exhausted";
  return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

function isWeakHumanization(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.length < 35) return true;
  return [
    "here is your",
    "here's your",
    "summary:",
    "based on the data",
    "i am unable",
    "no data provided"
  ].some((phrase) => normalized.startsWith(phrase));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
