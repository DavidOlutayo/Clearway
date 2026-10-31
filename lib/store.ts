import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentEvent, CaseRecord, ChatMessage } from "./types";
import { getSupabase } from "./supabase";

// Slice 1 store: JSON file persistence so cases survive server restarts,
// crashes and dev-server module reloads (an in-memory-only Map loses every
// case, surfacing as "Case not found." on the next request). Every read goes
// to disk, so two local servers also share state. Supabase wiring for real
// persistence comes later; events are additionally best-effort appended to
// Supabase when configured (TECH_BRIEF section 3: append-only events).
const STORE_FILE = join(process.cwd(), ".data", "clearway-store.json");

interface PersistedStore {
  cases: CaseRecord[];
  events: AgentEvent[];
}

function blankStore(): PersistedStore {
  return { cases: [], events: [] };
}

function loadStore(): PersistedStore {
  try {
    const raw = readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    return {
      cases: Array.isArray(parsed.cases) ? parsed.cases : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return blankStore();
  }
}

function saveStore(store: PersistedStore): void {
  mkdirSync(dirname(STORE_FILE), { recursive: true });
  const tmp = `${STORE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, STORE_FILE);
}

function now(): string {
  return new Date().toISOString();
}

export function createCase(note: string | null): CaseRecord {
  const record: CaseRecord = {
    id: randomUUID(),
    note,
    status: "intake",
    documents: [],
    discrepancies: [],
    unchecked: [],
    messages: [],
    createdAt: now(),
    updatedAt: now(),
  };
  const store = loadStore();
  store.cases.push(record);
  saveStore(store);
  void appendEvent(record.id, "case.created", { note });
  return getCase(record.id) as CaseRecord;
}

export function getCase(caseId: string): CaseRecord | null {
  return loadStore().cases.find((record) => record.id === caseId) ?? null;
}

export function saveCase(record: CaseRecord): void {
  record.updatedAt = now();
  const store = loadStore();
  const index = store.cases.findIndex((entry) => entry.id === record.id);
  if (index >= 0) store.cases[index] = record;
  else store.cases.push(record);
  saveStore(store);
}

export function appendMessage(
  record: CaseRecord,
  role: ChatMessage["role"],
  text: string,
): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    role,
    text,
    createdAt: now(),
  };
  const store = loadStore();
  const current = store.cases.find((entry) => entry.id === record.id);
  if (current) {
    current.messages.push(message);
    current.updatedAt = now();
    saveStore(store);
  }
  record.messages.push(message);
  record.updatedAt = now();
  return message;
}

export function appendEvent(
  caseId: string,
  type: string,
  payload: Record<string, unknown>,
): AgentEvent {
  const event: AgentEvent = {
    id: randomUUID(),
    caseId,
    type,
    payload,
    createdAt: now(),
  };
  const store = loadStore();
  store.events.push(event);
  saveStore(store);

  const supabase = getSupabase();
  if (supabase) {
    void supabase
      .from("events")
      .insert({
        id: event.id,
        case_id: caseId,
        type,
        payload,
        created_at: event.createdAt,
      })
      .then(({ error }) => {
        if (error) console.error("Supabase event insert failed:", error.message);
      });
  }
  return event;
}

export function listEvents(caseId: string): AgentEvent[] {
  return loadStore().events.filter((event) => event.caseId === caseId);
}
