import type { CaseFacts, Discrepancy, DocType, StoredDocument } from "./types";

export const LOW_CONFIDENCE_THRESHOLD = 0.8;

export function docTypeLabel(docType: DocType): string {
  switch (docType) {
    case "commercial_invoice":
      return "Commercial invoice";
    case "packing_list":
      return "Packing list";
    case "transport_document":
      return "Transport document";
    case "supplier_invoice":
      return "Supplier invoice";
    case "unsupported":
      return "Unsupported document";
    default:
      return "Unrecognised document";
  }
}

function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function markLow(confidence: number | undefined): string {
  return confidence !== undefined && confidence < LOW_CONFIDENCE_THRESHOLD
    ? " (check)"
    : "";
}

// One short "what I understood" block per document. Conclusion first,
// low-confidence fields marked for the user to check (PRD F2.2).
export function formatDocumentSummary(doc: StoredDocument): string {
  const extraction = doc.extraction;
  if (!extraction) return `${doc.fileName}: still processing.`;
  if (extraction.unreadable) {
    return (
      `${doc.fileName}: could not read this file.` +
      (extraction.note ? ` ${extraction.note}` : "") +
      ` Please send a clearer photo; continuing with the rest.`
    );
  }
  const fields: CaseFacts = extraction.fields;
  const conf = extraction.fieldConfidence ?? {};
  const lines = [
    `${docTypeLabel(extraction.docType)} — ${doc.fileName}${markLow(
      extraction.docTypeConfidence,
    )}`,
    `Goods: ${fmt(fields.productDescription)}${markLow(conf["productDescription"])}`,
    `Qty: ${fmt(fields.quantity)} ${fmt(fields.quantityUnit)}${markLow(conf["quantity"])} | Weight: ${fmt(fields.grossWeightKg)} kg${markLow(conf["grossWeightKg"])}`,
    `Value: ${fmt(fields.totalValue)} ${fmt(fields.currency)}${markLow(conf["totalValue"])}`,
    `From ${fmt(fields.exporter)} to ${fmt(fields.importer)}`,
    `Refs: ${fmt(fields.invoiceRef)} / ${fmt(fields.transportRef)}`,
  ];
  return lines.join("\n");
}

export function formatDiscrepancyCard(disc: Discrepancy): string {
  const icon = disc.severity === "Blocking" ? "⛔" : disc.severity === "Check" ? "⚠️" : "ℹ️";
  return [
    `${icon} ${disc.severity}: ${disc.label}`,
    `"${disc.valueA}" (${disc.sourceA})`,
    `vs "${disc.valueB}" (${disc.sourceB})`,
    disc.suggestion,
  ].join("\n");
}
