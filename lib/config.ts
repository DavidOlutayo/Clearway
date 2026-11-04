export const config = {
  metaApiKey: process.env.META_API_KEY ?? "",
  metaBaseUrl: process.env.META_BASE_URL ?? "https://api.meta.ai/v1",
  metaModel: process.env.META_MODEL ?? "muse-spark-1.3",
  toolCallCap: Number(process.env.AGENT_TOOL_CALL_CAP ?? 8),
  turnTimeoutMs: Number(process.env.AGENT_TURN_TIMEOUT_MS ?? 55000),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Live demo switch. Only an explicit "false" turns live runs off;
  // anything else (including unset) keeps them on.
  demoLive: process.env.DEMO_LIVE !== "false",
};

export function isSupabaseConfigured(): boolean {
  return config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
}
