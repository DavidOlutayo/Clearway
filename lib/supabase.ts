import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "./config";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  if (!isSupabaseConfigured()) {
    cached = null;
    return cached;
  }
  try {
    cached = createClient(config.supabaseUrl, config.supabaseAnonKey);
  } catch (error) {
    // supabase-js eagerly builds a realtime client that needs a WebSocket
    // global (missing on Node 20): treat Supabase as unavailable, never
    // fatal. Callers fall back to local persistence.
    console.error(
      "Supabase client init failed; using local fallback:",
      error instanceof Error ? error.message.split("\n")[0] : error,
    );
    cached = null;
  }
  return cached;
}
