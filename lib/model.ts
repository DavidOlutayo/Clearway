import OpenAI from "openai";
import { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "./config";

let cached: OpenAI | null = null;

// The SDK's transport ignores *_PROXY, which breaks model calls behind
// an egress proxy. Honour the operator's proxy; returns undefined (SDK
// default, direct connection) on machines without one.
function proxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxy =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!proxy) return undefined;
  return new HttpsProxyAgent(proxy);
}

export function getModelClient(): OpenAI {
  if (!config.metaApiKey) {
    throw new Error("META_API_KEY is not set. Copy .env.example to .env first.");
  }
  if (!cached) {
    cached = new OpenAI({
      apiKey: config.metaApiKey,
      baseURL: config.metaBaseUrl,
      httpAgent: proxyAgent(),
    });
  }
  return cached;
}

export function modelName(): string {
  return config.metaModel;
}
