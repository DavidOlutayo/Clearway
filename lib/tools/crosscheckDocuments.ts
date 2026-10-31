import { createHash } from "node:crypto";
import type { CaseFacts, Discrepancy, Severity, StoredDocument } from "../../types";

type FactKey = keyof CaseFacts;

interface FieldSpec {
  key: FactKey;
  label: string;
  severity: Severity;
  suggestion: string;
  numeric?: boolean;
}

// Severity mapping is a judgement call (PRD names the levels but not the
// mapping): value/currency/quantity/weight mismatches block handoff,
// parties/dates/refs/origin need a check, wording is a note.
const FIELD_SPECS: FieldSpec[] = [
  { key: "totalValue", label: "Total value", severity: "Blocking", suggestion: "Confirm which total is correct; the commercial invoice is usually the authority for value.", numeric: true },
  { key: "currency", label: "Currency", severity: "Blocking", suggestion: "Confirm the correct currency with the client. Values are never converted silently." },
  { key: "quantity", label: "Quantity", severity: "Blocking", suggestion: "Confirm the correct quantity; check whether units match across documents.", numeric: true },
  { key: "grossWeightKg", label: "Gross weight", severity: "Blocking", suggestion: "Confirm the correct gross weight in kilograms.", numeric: true },
  { key: "netWeightKg", label: "Net weight", severity: "Blocking", suggestion: "Confirm the correct net weight in kilograms.", numeric: true },
  { key: "exporter", label: "Exporter", severity: "Check", suggestion: "Confirm the correct exporter name; small spelling differences still need a decision." },
  { key: "importer", label: "Importer", severity: "Check", suggestion: "Confirm the correct importer name." },
  { key: "invoiceDate", label: "Invoice date", severity: "Check", suggestion: "Confirm which date is correct." },
  { key: "shipmentDate", label: "Shipment date", severity: "Check", suggestion: "Confirm which shipment date is correct." },
  { key: "transportRef", label: "Transport reference", severity: "Check", suggestion: "Confirm which transport reference is correct." },
  { key: "invoiceRef", label: "Invoice reference", severity: "Check", suggestion: "Confirm which invoice reference is correct." },
  { key: "originStatement", label: "Origin statement", severity: "Check", suggestion: "Confirm which origin statement reflects the exporter's records." },
  { key: "productDescription", label: "Product description", severity: "Note", suggestion: "Check the descriptions refer to the same goods." },
  { key: "deliveryTerms", label: "Delivery terms", severity: "Note", suggestion: "Confirm the agreed delivery terms." },
  { key: "transportMode", label: "Transport mode", severity: "Note", suggestion: "Confirm the transport mode." },
];

function rawValue(doc: StoredDocument, key: FactKey): string | number | null | undefined {
  return doc.extraction?.fields[key] as string | number | null | undefined;
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalize(value: string | number, numeric?: boolean): string {
  if (numeric) return String(value).trim();
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function stableId(field: string, a: string, b: string): string {
  return createHash("sha256").update(`${field}|${a}|${b}`).digest("hex").slice(0, 12);
}

export interface CrosscheckResult {
  discrepancies: Discrepancy[];
  unchecked: string[];
}

// Pure code comparison across readable documents. Never picks a winner:
// each discrepancy shows both values with their sources (PRD F3.2).
export function crosscheckDocuments(documents: StoredDocument[]): CrosscheckResult {
  const readable = documents.filter((doc) => doc.extraction && !doc.extraction.unreadable);
  const discrepancies: Discrepancy[] = [];
  const unchecked: string[] = [];

  if (readable.length < 2) {
    unchecked.push("Only one readable document; cross-document checks are limited.");
  }

  for (const spec of FIELD_SPECS) {
    const stated = readable.filter((doc) => isPresent(rawValue(doc, spec.key)));
    if (stated.length < 2) {
      if (stated.length === 1 && readable.length >= 2) {
        unchecked.push(`Only ${stated[0].fileName} states ${spec.label.toLowerCase()}; could not cross-check.`);
      }
      continue;
    }
    const first = stated[0];
    const firstNorm = normalize(rawValue(first, spec.key) as string | number, spec.numeric);
    const conflict = stated.slice(1).find((doc) => {
      const norm = normalize(rawValue(doc, spec.key) as string | number, spec.numeric);
      if (spec.numeric) return Number(norm) !== Number(firstNorm);
      return norm !== firstNorm;
    });
    if (!conflict) continue;

    const valueA = String(rawValue(first, spec.key));
    const valueB = String(rawValue(conflict, spec.key));
    discrepancies.push({
      id: stableId(spec.key, valueA, valueB),
      severity: spec.severity,
      field: spec.key,
      label: spec.label,
      valueA,
      sourceA: first.fileName,
      valueB,
      sourceB: conflict.fileName,
      suggestion: spec.suggestion,
      resolved: false,
    });
  }

  const hasTransportDoc = readable.some(
    (doc) => doc.extraction?.docType === "transport_document",
  );
  if (!hasTransportDoc) {
    unchecked.push("No transport document uploaded; transport checks were skipped.");
  }

  return { discrepancies, unchecked };
}

// Keep the user's resolutions when checks re-run after a correction.
export function preserveResolved(
  previous: Discrepancy[],
  fresh: Discrepancy[],
): Discrepancy[] {
  const resolvedById = new Map(previous.filter((d) => d.resolved).map((d) => [d.id, d]));
  return fresh.map((disc) => {
    const prior = resolvedById.get(disc.id);
    if (!prior) return disc;
    return {
      ...disc,
      resolved: true,
      resolvedValue: prior.resolvedValue,
      resolvedReason: prior.resolvedReason,
    };
  });
}
