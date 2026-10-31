import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "./config";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  if (!isSupabaseConfigured()) {
    cached = null;
    return cached;
  }
  cached = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return cached;
}
