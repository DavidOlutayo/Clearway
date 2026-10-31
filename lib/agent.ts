import { randomUUID } from "node:crypto";
import { config } from "./config";
import { MAX_FILES_PER_CASE, isSupportedMime, sha256Hex } from "./files";
import { formatDiscrepancyCard, formatDocumentSummary } from "./format";
import { appendEvent, appendMessage, getCase } from "./store";
import { takePending } from "./pending";
import { crosscheckDocuments, preserveResolved } from "./tools/crosscheckDocuments";
import { extractDocuments } from "./tools/extractDocuments";
import { parseCorrection } from "./tools/parseCorrection";
import type { CaseFacts, CaseRecord, ChatMessage, StoredDocument } from "./types";

// Channel-agnostic agent core: a case goes in, messages and findings
// come out. The web chat is a thin adapter over these functions.

const NUMERIC_FIELDS: ReadonlySet<string> = new Set([
  "quantity",
  "grossWeightKg",
  "netWeightKg",
  "totalValue",
]);

const KNOWN_FIELDS = [
  "exporter",
  "importer",
  "productDescription",
  "quantity",
  "quantityUnit",
  "grossWeightKg",
  "netWeightKg",
  "totalValue",
  "currency",
  "invoiceDate",
  "shipmentDate",
  "deliveryTerms",
  "transportMode",
  "transportRef",
  "invoiceRef",
  "originStatement",
  "declaredHsCode",
] as const;

class LoopCapExceeded extends Error {}

class TurnGuard {
  private callsUsed = 0;

  constructor(private readonly caseId: string) {}

  count(tool: string, detail: Record<string, unknown> = {}): void {
    this.callsUsed += 1;
    appendEvent(this.caseId, "tool.called", { tool, ...detail, callsUsed: this.callsUsed });
    if (this.callsUsed > config.toolCallCap) {
      throw new LoopCapExceeded(`Tool-call cap of ${config.toolCallCap} exceeded at ${tool}.`);
    }
  }
}

async function withTurnTimeout<T>(caseId: string, work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), config.turnTimeoutMs);
  });
  const result = await Promise.race([work, timeout]);
  if (timer) clearTimeout(timer);
  if (result === null) {
    const record = getCase(caseId);
    if (record) {
      appendMessage(
        record,
        "assistant",
        "Still working on your bundle — it is taking longer than expected. Your files are saved; tap Process again in a moment.",
      );
    }
  }
  return result;
}

function say(record: CaseRecord, out: ChatMessage[], text: string): void {
  out.push(appendMessage(record, "assistant", text));
}

function coerceValue(field: string, raw: string): string | number {
  if (!NUMERIC_FIELDS.has(field)) return raw;
  const numeric = Number(raw.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(numeric) && raw.trim() !== "" ? numeric : raw;
}

// F1+F2+F3: recognise new files, extract, summarise, cross-check.
export async function processPendingFiles(caseId: string): Promise<ChatMessage[]> {
  const record = getCase(caseId);
  if (!record) throw new Error("Case not found.");
  const out: ChatMessage[] = [];
  const guard = new TurnGuard(caseId);

  const result = await withTurnTimeout(caseId, (async () => {
    const incoming = takePending(caseId);
    if (incoming.length === 0) {
      say(record, out, "No new files to process. Upload photos or PDFs to add them to this case.");
      return true;
    }

    const room = MAX_FILES_PER_CASE - record.documents.length;
    if (room <= 0) {
      say(record, out, `This case already has ${MAX_FILES_PER_CASE} files, the per-case limit. Start a new case for more.`);
      return true;
    }
    const skipped = incoming.slice(room);
    const accepted = incoming.slice(0, room);

    const existingHashes = new Set(record.documents.map((doc) => doc.sha256));
    const batchHashes = new Set<string>();
    const duplicates: string[] = [];
    const fresh: { fileName: string; mimeType: string; buffer: Buffer }[] = [];

    for (const file of accepted) {
      const hash = sha256Hex(file.buffer);
      if (existingHashes.has(hash) || batchHashes.has(hash)) {
        duplicates.push(file.fileName);
        appendEvent(caseId, "file.duplicate_ignored", { fileName: file.fileName });
        continue;
      }
      batchHashes.add(hash);
      fresh.push(file);
    }

    const created: StoredDocument[] = [];
    const toExtract: { index: number; fileName: string; mimeType: string; buffer: Buffer }[] = [];
    for (const file of fresh) {
      const doc: StoredDocument = {
        id: randomUUID(),
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        sha256: sha256Hex(file.buffer),
        extraction: null,
        createdAt: new Date().toISOString(),
      };
      if (!isSupportedMime(file.mimeType)) {
        doc.extraction = {
          docType: "unsupported",
          docTypeConfidence: 1,
          fields: {},
          fieldConfidence: {},
          unreadable: true,
          note: `${file.fileName} is not a supported photo or PDF; please send another copy.`,
        };
        appendEvent(caseId, "file.unreadable", { fileName: file.fileName, reason: "unsupported-type" });
      } else {
        toExtract.push({ index: created.length, fileName: file.fileName, mimeType: file.mimeType, buffer: file.buffer });
      }
      created.push(doc);
    }
    record.documents.push(...created);

    if (toExtract.length > 0) {
      guard.count("extract_documents", { files: toExtract.length });
      const { extractions, tokens } = await extractDocuments(toExtract);
      appendEvent(caseId, "extraction.completed", { files: toExtract.length, tokens });
      for (let i = 0; i < toExtract.length; i++) {
        created[toExtract[i].index].extraction = extractions[i];
        if (extractions[i].unreadable) {
          appendEvent(caseId, "file.unreadable", { fileName: toExtract[i].fileName });
        }
      }
    }

    guard.count("crosscheck_documents", { documents: record.documents.length });
    const { discrepancies, unchecked } = crosscheckDocuments(record.documents);
    record.discrepancies = preserveResolved(record.discrepancies, discrepancies);
    record.unchecked = unchecked;
    const blocking = record.discrepancies.filter((d) => d.severity === "Blocking" && !d.resolved);
    const unreadable = record.documents.filter((d) => d.extraction?.unreadable);
    record.status = blocking.length > 0 || unreadable.length > 0 ? "needs_input" : "ready";
    appendEvent(caseId, "crosscheck.completed", {
      discrepancies: record.discrepancies.length,
      blocking: blocking.length,
    });

    const recognised = created
      .filter((d) => d.extraction && !d.extraction.unreadable)
      .map((d) => d.fileName);
    say(
      record,
      out,
      recognised.length > 0
        ? `Got it — I recognised ${recognised.length} document${recognised.length === 1 ? "" : "s"}: ${recognised.join(", ")}. Here is what I understood.`
        : "I could not confidently recognise these files. Here is what I found.",
    );
    for (const doc of created) say(record, out, formatDocumentSummary(doc));
    if (duplicates.length > 0) {
      say(record, out, `Ignored ${duplicates.length} repeat upload${duplicates.length === 1 ? "" : "s"}: ${duplicates.join(", ")}.`);
    }
    if (skipped.length > 0) {
      say(record, out, `Kept the first ${MAX_FILES_PER_CASE} files; skipped ${skipped.length}: ${skipped.map((f) => f.fileName).join(", ")}.`);
    }

    const open = record.discrepancies.filter((d) => !d.resolved);
    if (open.length === 0) {
      say(record, out, "No disagreements between the readable documents. Next: tell me if anything above looks wrong, or upload more files.");
    } else {
      say(record, out, `I found ${open.length} disagreement${open.length === 1 ? "" : "s"} across your documents:`);
      for (const disc of open) say(record, out, formatDiscrepancyCard(disc));
      if (blocking.length > 0) {
        say(record, out, `${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} need${blocking.length === 1 ? "s" : ""} your decision before this case can be approved. Reply with the correct value, e.g. "the total is 12,400".`);
      } else {
        say(record, out, "Nothing blocking. Reply with any correction, or resolve each item with the value you confirm.");
      }
    }
    if (unchecked.length > 0) {
      say(record, out, `Could not check everything:\n${unchecked.map((item) => `• ${item}`).join("\n")}`);
    }
    return true;
  })());

  if (result === null) {
    // Timeout fallback message was already appended inside withTurnTimeout.
    return record.messages.slice(-1);
  }
  return out;
}

// F2.3 + questions: corrections in plain language, plus "why?" and
// "what's missing?" answers from the recorded findings.
export async function applyUserText(caseId: string, text: string): Promise<ChatMessage[]> {
  const record = getCase(caseId);
  if (!record) throw new Error("Case not found.");
  appendMessage(record, "user", text);
  const out: ChatMessage[] = [];
  const guard = new TurnGuard(caseId);
  const lowered = text.toLowerCase();

  const result = await withTurnTimeout(caseId, (async () => {
    if (lowered.includes("missing") || lowered.includes("need") || lowered.includes("outstanding")) {
      const lines: string[] = [];
      const unreadable = record.documents.filter((d) => d.extraction?.unreadable);
      for (const doc of unreadable) lines.push(`• Clearer copy of ${doc.fileName}`);
      for (const disc of record.discrepancies.filter((d) => !d.resolved && d.severity === "Blocking")) {
        lines.push(`• Decide ${disc.label}: "${disc.valueA}" vs "${disc.valueB}"`);
      }
      for (const item of record.unchecked) lines.push(`• ${item}`);
      say(record, out, lines.length > 0 ? `What is still needed:\n${lines.join("\n")}` : "Nothing is outstanding on the current evidence. Upload more files or tell me what changed.");
      return true;
    }

    if (lowered.includes("why")) {
      const disc = record.discrepancies.find((d) => !d.resolved);
      say(
        record,
        out,
        disc
          ? `Because your documents disagree on ${disc.label.toLowerCase()}: "${disc.valueA}" in ${disc.sourceA} vs "${disc.valueB}" in ${disc.sourceB}. ${disc.suggestion}`
          : "There are no open findings to explain. Upload documents or ask what is missing.",
      );
      return true;
    }

    if (lowered.includes("status") || lowered.includes("where") || lowered.includes("recap")) {
      const open = record.discrepancies.filter((d) => !d.resolved).length;
      say(record, out, `Case status: ${record.documents.length} document${record.documents.length === 1 ? "" : "s"}, ${open} open disagreement${open === 1 ? "" : "s"}. ${open > 0 ? "Reply with a correction or resolve each item." : "Nothing open right now."}`);
      return true;
    }

    guard.count("parse_correction", {});
    const parsed = await parseCorrection(text, [...KNOWN_FIELDS]);
    if (!parsed) {
      say(record, out, "I did not catch that as a correction. Try e.g. \"the quantity is 500\" or \"use the invoice total\".");
      return true;
    }

    const target =
      record.documents.find((d) => parsed.docFileName && d.fileName.includes(parsed.docFileName)) ??
      record.documents.find((d) => {
        const value = d.extraction?.fields[parsed.field as keyof CaseFacts];
        return value !== null && value !== undefined && String(value).trim() !== "";
      }) ??
      record.documents.find((d) => d.extraction && !d.extraction.unreadable) ??
      null;

    if (!target || !target.extraction) {
      say(record, out, "There is no readable document to correct yet. Upload files first.");
      return true;
    }

    const before = record.discrepancies.filter((d) => !d.resolved).length;
    const coerced = coerceValue(parsed.field, parsed.newValue);
    (target.extraction.fields as Record<string, unknown>)[parsed.field] = coerced;
    target.extraction.fieldConfidence[parsed.field] = 1;
    target.extraction.unreadable = false;
    appendEvent(caseId, "correction.applied", {
      field: parsed.field,
      newValue: coerced,
      document: target.fileName,
    });

    guard.count("crosscheck_documents", { reason: "correction" });
    const { discrepancies, unchecked } = crosscheckDocuments(record.documents);
    record.discrepancies = preserveResolved(record.discrepancies, discrepancies);
    record.unchecked = unchecked;
    const after = record.discrepancies.filter((d) => !d.resolved).length;

    say(record, out, `Updated ${parsed.field} to "${coerced}" in ${target.fileName}. Open disagreements: ${before} → ${after}.`);
    const newlyOpen = record.discrepancies.filter((d) => !d.resolved).slice(0, 3);
    for (const disc of newlyOpen) say(record, out, formatDiscrepancyCard(disc));
    return true;
  })());

  if (result === null) return record.messages.slice(-1);
  return out;
}

// F3.3: the user decides which value is correct.
export function resolveDiscrepancy(
  caseId: string,
  discrepancyId: string,
  correctValue: string,
  reason?: string,
): ChatMessage {
  const record = getCase(caseId);
  if (!record) throw new Error("Case not found.");
  const disc = record.discrepancies.find((d) => d.id === discrepancyId);
  if (!disc) throw new Error("Discrepancy not found.");
  disc.resolved = true;
  disc.resolvedValue = correctValue;
  disc.resolvedReason = reason ?? null;
  appendEvent(caseId, "discrepancy.resolved", {
    field: disc.field,
    correctValue,
    reason: reason ?? null,
  });
  return appendMessage(record, "assistant", `Resolved ${disc.label}: using "${correctValue}".${reason ? ` Noted: ${reason}` : ""}`);
}

export { LoopCapExceeded };
