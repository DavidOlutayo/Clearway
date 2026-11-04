// Live demo rate limiting. One "run" is one call to /process (the model
// read of an uploaded bundle). Every run attempt is recorded before any
// model work, in Supabase when configured, otherwise in a local file.
// No login: a visitor is a random browser cookie id plus the client IP
// taken from the x-forwarded-for header. A limit applies when EITHER the
// cookie id or the IP is over, so clearing cookies alone does not bypass
// the per-visitor limits.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config, isSupabaseConfigured } from "./config";

export const VISITOR_COOKIE = "demo_visitor";

export const LIMITS = {
  perVisitorHour: 10,
  perVisitorDay: 30,
  globalDay: 300,
} as const;

const HOUR_MS = 3600_000;
const DAY_MS = 86400_000;

export const LIMIT_MESSAGES = {
  visitorHour:
    "You've used all 10 of your free runs for this hour. Please wait a little and try again — or explore the saved replay, which shows the full demo.",
  visitorDay:
    "You've used all 30 of your free runs for today. Please come back tomorrow — or explore the saved replay, which shows the full demo.",
  globalDay:
    "The live demo has had 300 runs today and is resting. Please try again tomorrow — or explore the saved replay, which shows the full demo.",
  paused:
    "Live runs are paused right now, but you can still explore the full demo as a saved replay.",
} as const;

export type LimitScope = "visitor_hour" | "visitor_day" | "global_day";

export type LimitCheck =
  | { allowed: true }
  | { allowed: false; scope: LimitScope; message: string };

// First entry of x-forwarded-for is the client IP (Next.js on Vercel sits
// behind proxies, so the socket address would be the proxy's). Sanitised
// to IP characters only; anything else means "unknown".
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = (forwarded.split(",")[0] ?? "").trim();
  return /^[A-Za-z0-9.:]{1,100}$/.test(first) ? first : "";
}

// Random id we set as a long-lived cookie. Sanitised to cookie-safe id
// characters; anything else is treated as missing (caller mints a fresh
// id and sets the cookie on the response).
export function getVisitorIdFromCookie(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  const part = header
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${VISITOR_COOKIE}=`));
  if (!part) return null;
  let value = part.slice(VISITOR_COOKIE.length + 1).trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  return /^[A-Za-z0-9-]{1,100}$/.test(value) ? value : null;
}

// Remote counting over plain PostgREST (no supabase-js): the JS client
// throws on Node 20 (no WebSocket global), while fetch works on every
// runtime. Counts come from the Content-Range header of a count=exact
// query, so no row bodies are transferred.
function restBase(): string {
  return config.supabaseUrl.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

function restHeaders(): Record<string, string> {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json",
  };
}

function parseCount(res: Response): number {
  const match = (res.headers.get("content-range") ?? "").match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function countRemote(sinceIso: string, visitorId: string, ip: string): Promise<number> {
  const params = new URLSearchParams({ select: "id", created_at: `gte.${sinceIso}` });
  // Sanitised inputs only, so the `or` filter cannot break out.
  if (ip !== "") params.set("or", `(visitor_id.eq.${visitorId},ip.eq.${ip})`);
  else params.set("visitor_id", `eq.${visitorId}`);
  const res = await fetch(`${restBase()}/rest/v1/demo_runs?${params}`, {
    headers: { ...restHeaders(), Prefer: "count=exact" },
  });
  if (!res.ok) throw new Error(`demo_runs count failed: HTTP ${res.status}`);
  await res.arrayBuffer().catch(() => undefined);
  return parseCount(res);
}

async function countRemoteGlobal(sinceIso: string): Promise<number> {
  const params = new URLSearchParams({ select: "id", created_at: `gte.${sinceIso}` });
  const res = await fetch(`${restBase()}/rest/v1/demo_runs?${params}`, {
    headers: { ...restHeaders(), Prefer: "count=exact" },
  });
  if (!res.ok) throw new Error(`demo_runs global count failed: HTTP ${res.status}`);
  await res.arrayBuffer().catch(() => undefined);
  return parseCount(res);
}

async function recordRemote(visitorId: string, ip: string): Promise<void> {
  const res = await fetch(`${restBase()}/rest/v1/demo_runs`, {
    method: "POST",
    headers: { ...restHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ visitor_id: visitorId, ip }),
  });
  if (!res.ok) throw new Error(`demo_runs insert failed: HTTP ${res.status}`);
  await res.arrayBuffer().catch(() => undefined);
}

// Local fallback when Supabase is not configured (or errors): same shape
// and same windows, persisted next to the case store. Rows older than a
// day are pruned on every write.
interface LocalRun {
  v: string;
  ip: string;
  at: number;
}

const LOCAL_FILE = join(process.cwd(), ".data", "demo-runs.json");

function loadLocal(): LocalRun[] {
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_FILE, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is LocalRun =>
        !!row &&
        typeof row === "object" &&
        typeof (row as LocalRun).v === "string" &&
        typeof (row as LocalRun).at === "number",
    );
  } catch {
    return [];
  }
}

function saveLocal(runs: LocalRun[]): void {
  const fresh = runs.filter((row) => Date.now() - row.at < DAY_MS);
  mkdirSync(dirname(LOCAL_FILE), { recursive: true });
  const tmp = `${LOCAL_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(fresh));
  renameSync(tmp, LOCAL_FILE);
}

function checkLocal(visitorId: string, ip: string): LimitCheck {
  const runs = loadLocal();
  const matchesVisitor = (row: LocalRun): boolean =>
    row.v === visitorId || (ip !== "" && row.ip === ip);
  const hourCount = runs.filter((row) => Date.now() - row.at < HOUR_MS && matchesVisitor(row)).length;
  if (hourCount >= LIMITS.perVisitorHour) {
    return { allowed: false, scope: "visitor_hour", message: LIMIT_MESSAGES.visitorHour };
  }
  const dayCount = runs.filter((row) => Date.now() - row.at < DAY_MS && matchesVisitor(row)).length;
  if (dayCount >= LIMITS.perVisitorDay) {
    return { allowed: false, scope: "visitor_day", message: LIMIT_MESSAGES.visitorDay };
  }
  const globalCount = runs.filter((row) => Date.now() - row.at < DAY_MS).length;
  if (globalCount >= LIMITS.globalDay) {
    return { allowed: false, scope: "global_day", message: LIMIT_MESSAGES.globalDay };
  }
  saveLocal([...runs, { v: visitorId, ip, at: Date.now() }]);
  return { allowed: true };
}

// Check the three limits, recording the run when allowed. Supabase first;
// local file when Supabase is not configured or fails.
export async function checkDemoRun(visitorId: string, ip: string): Promise<LimitCheck> {
  if (isSupabaseConfigured()) {
    try {
      const hourAgo = new Date(Date.now() - HOUR_MS).toISOString();
      const dayAgo = new Date(Date.now() - DAY_MS).toISOString();
      if ((await countRemote(hourAgo, visitorId, ip)) >= LIMITS.perVisitorHour) {
        return { allowed: false, scope: "visitor_hour", message: LIMIT_MESSAGES.visitorHour };
      }
      if ((await countRemote(dayAgo, visitorId, ip)) >= LIMITS.perVisitorDay) {
        return { allowed: false, scope: "visitor_day", message: LIMIT_MESSAGES.visitorDay };
      }
      if ((await countRemoteGlobal(dayAgo)) >= LIMITS.globalDay) {
        return { allowed: false, scope: "global_day", message: LIMIT_MESSAGES.globalDay };
      }
      await recordRemote(visitorId, ip);
      return { allowed: true };
    } catch (error) {
      console.error("Supabase demo_runs failed, using local fallback:", error instanceof Error ? error.message : error);
    }
  }
  return checkLocal(visitorId, ip);
}
