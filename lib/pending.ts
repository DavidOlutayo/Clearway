import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Holding area for uploaded file bytes between the instant acknowledgement
// (upload route) and the model run (process route). Persisted to disk
// (base64) alongside the case store so an upload survives a server restart
// or module reload in the seconds before processing runs.
export interface PendingFile {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

const PENDING_FILE = join(process.cwd(), ".data", "clearway-pending.json");

interface PersistedPendingFile {
  fileName: string;
  mimeType: string;
  base64: string;
}

type PersistedPending = Record<string, PersistedPendingFile[]>;

function loadPending(): PersistedPending {
  try {
    const parsed = JSON.parse(readFileSync(PENDING_FILE, "utf8")) as unknown;
    if (parsed && typeof parsed === "object") return parsed as PersistedPending;
    return {};
  } catch {
    return {};
  }
}

function savePendingFile(pending: PersistedPending): void {
  mkdirSync(dirname(PENDING_FILE), { recursive: true });
  const tmp = `${PENDING_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(pending));
  renameSync(tmp, PENDING_FILE);
}

function revive(entry: PersistedPendingFile): PendingFile {
  return {
    fileName: entry.fileName,
    mimeType: entry.mimeType,
    buffer: Buffer.from(entry.base64, "base64"),
  };
}

export function savePending(caseId: string, files: PendingFile[]): void {
  const pending = loadPending();
  const existing = pending[caseId] ?? [];
  pending[caseId] = [
    ...existing,
    ...files.map((file) => ({
      fileName: file.fileName,
      mimeType: file.mimeType,
      base64: file.buffer.toString("base64"),
    })),
  ];
  savePendingFile(pending);
}

export function takePending(caseId: string): PendingFile[] {
  const pending = loadPending();
  const files = pending[caseId] ?? [];
  delete pending[caseId];
  savePendingFile(pending);
  return files.map(revive);
}

// Non-destructive read: lets a run inspect the pending files and claim
// them (takePending) only after the slow/fallible work succeeds, so a
// timeout or model failure leaves the upload intact for a retry.
export function peekPending(caseId: string): PendingFile[] {
  const files = loadPending()[caseId] ?? [];
  return files.map(revive);
}

export function peekPendingCount(caseId: string): number {
  return loadPending()[caseId]?.length ?? 0;
}
