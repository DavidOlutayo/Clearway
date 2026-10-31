import OpenAI from "openai";
import { config } from "./config";

let cached: OpenAI | null = null;

export function getModelClient(): OpenAI {
  if (!config.metaApiKey) {
    throw new Error("META_API_KEY is not set. Copy .env.example to .env first.");
  }
  if (!cached) {
    cached = new OpenAI({
      apiKey: config.metaApiKey,
      baseURL: config.metaBaseUrl,
    });
  }
  return cached;
}

export function modelName(): string {
  return config.metaModel;
}
