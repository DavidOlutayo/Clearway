// In-memory holding area for uploaded file bytes between the instant
// acknowledgement (upload route) and the model run (process route).
// Slice 1 only; Supabase Storage wiring comes with persistence later.

export interface PendingFile {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

const pending = new Map<string, PendingFile[]>();

export function savePending(caseId: string, files: PendingFile[]): void {
  const existing = pending.get(caseId) ?? [];
  pending.set(caseId, [...existing, ...files]);
}

export function takePending(caseId: string): PendingFile[] {
  const files = pending.get(caseId) ?? [];
  pending.delete(caseId);
  return files;
}

export function peekPendingCount(caseId: string): number {
  return pending.get(caseId)?.length ?? 0;
}
