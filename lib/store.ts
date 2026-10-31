import { randomUUID } from "node:crypto";
import type { AgentEvent, CaseRecord, ChatMessage } from "./types";
import { getSupabase } from "./supabase";

// Slice 1 store: in-memory source of truth so the chat works locally
// with no external services. Every event is also best-effort appended
// to Supabase when configured (TECH_BRIEF section 3: append-only events).
const cases = new Map<string, CaseRecord>();
const events: AgentEvent[] = [];

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
  cases.set(record.id, record);
  void appendEvent(record.id, "case.created", { note });
  return record;
}

export function getCase(caseId: string): CaseRecord | null {
  return cases.get(caseId) ?? null;
}

export function saveCase(record: CaseRecord): void {
  record.updatedAt = now();
  cases.set(record.id, record);
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
  record.messages.push(message);
  saveCase(record);
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
  events.push(event);

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
  return events.filter((event) => event.caseId === caseId);
}
