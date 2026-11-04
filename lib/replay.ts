import type { CaseRecord, ChatMessage, StoredDocument } from "./types";

// Saved replay of the sample shipment (Ghana → Kenya, cotton bed linen),
// shown when live runs are paused or rate-limited. It mirrors the exact
// shape of a real run: same message texts the agent code emits, same
// discrepancy cards, same resolutions. Read-only: the UI renders it with
// the same components but disables inputs and labels it as a replay.
//
// Honesty: slices 2–3 (classification, preference verdict, duty) are not
// built, so the replay shows the AfCFTA evidence the run gathered (origin
// statements, declared HS code) and the standard caution — never a
// preference verdict.
//
// Client-safe: plain data only, no Node APIs (page.tsx imports this).
export const REPLAY_LABEL = "Saved replay";

const BASE = new Date("2026-11-02T14:30:00.000Z").getTime();

function at(minuteOffset: number): string {
  return new Date(BASE + minuteOffset * 60_000).toISOString();
}

function msg(id: string, role: ChatMessage["role"], text: string, minuteOffset: number): ChatMessage {
  return { id, role, text, createdAt: at(minuteOffset) };
}

function doc(
  id: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  extraction: StoredDocument["extraction"],
): StoredDocument {
  return { id, fileName, mimeType, sizeBytes, sha256: `replay-${id}`, extraction, createdAt: at(0) };
}

export interface ReplayAuditEntry {
  timestamp: string;
  issue: string;
  resolution: string;
}

export function getReplayAudit(): ReplayAuditEntry[] {
  return [
    { timestamp: at(3), issue: "Quantity", resolution: "500" },
    { timestamp: at(4), issue: "Gross weight", resolution: "1200" },
  ];
}

export function getReplayCase(): CaseRecord {
  return {
    id: "replay-sample-shipment",
    note: "Ghana → Kenya, cotton bed linen",
    status: "ready",
    documents: [
      doc("replay-doc-1", "invoice_Acme_0042.pdf", "application/pdf", 184_320, {
        docType: "commercial_invoice",
        docTypeConfidence: 0.97,
        fields: {
          exporter: "Accra Textile Mills Ltd",
          importer: "Nairobi Home Goods Ltd",
          productDescription: "Cotton bed linen sets, 100% cotton",
          quantity: 500,
          quantityUnit: "sets",
          grossWeightKg: 1200,
          netWeightKg: 1100,
          totalValue: 12400,
          currency: "USD",
          invoiceDate: "2026-10-20",
          shipmentDate: "2026-10-25",
          deliveryTerms: "CIF Mombasa",
          transportMode: "Sea",
          transportRef: "MAERSK 884102",
          invoiceRef: "INV-2026-0042",
          originStatement: "Goods wholly obtained in Ghana",
          declaredHsCode: "6302.31",
        },
        fieldConfidence: {
          exporter: 0.98,
          importer: 0.97,
          productDescription: 0.94,
          quantity: 0.96,
          grossWeightKg: 0.95,
          totalValue: 0.96,
          currency: 0.99,
          originStatement: 0.91,
          declaredHsCode: 0.9,
        },
        unreadable: false,
      }),
      doc("replay-doc-2", "packing_list_photo.jpg", "image/jpeg", 412_672, {
        docType: "packing_list",
        docTypeConfidence: 0.88,
        fields: {
          exporter: "Accra Textile Mills Ltd",
          importer: "Nairobi Home Goods Ltd",
          productDescription: "Bed linen sets (cotton)",
          quantity: 500,
          quantityUnit: "sets",
          grossWeightKg: 1185,
          netWeightKg: null,
          totalValue: 12400,
          currency: "USD",
          invoiceDate: "2026-10-20",
          shipmentDate: null,
          deliveryTerms: "CIF Mombasa",
          transportMode: null,
          transportRef: "MAERSK 884102",
          invoiceRef: "INV-2026-0042",
          originStatement: "Made in Ghana",
          declaredHsCode: null,
        },
        fieldConfidence: {
          exporter: 0.93,
          importer: 0.92,
          productDescription: 0.9,
          quantity: 0.94,
          grossWeightKg: 0.62,
          totalValue: 0.9,
          currency: 0.97,
          originStatement: 0.89,
        },
        unreadable: false,
      }),
      doc("replay-doc-3", "bill_of_lading.pdf", "application/pdf", 96_256, {
        docType: "transport_document",
        docTypeConfidence: 0.93,
        fields: {
          exporter: "Accra Textile Mills Ltd",
          importer: "Nairobi Home Goods Ltd",
          productDescription: "Cotton bed linen, 45 cartons",
          quantity: 450,
          quantityUnit: "sets",
          grossWeightKg: 1200,
          netWeightKg: null,
          totalValue: null,
          currency: null,
          invoiceDate: null,
          shipmentDate: "2026-10-25",
          deliveryTerms: null,
          transportMode: "Sea",
          transportRef: "MAERSK 884102",
          invoiceRef: null,
          originStatement: null,
          declaredHsCode: null,
        },
        fieldConfidence: {
          exporter: 0.92,
          importer: 0.9,
          productDescription: 0.85,
          quantity: 0.91,
          grossWeightKg: 0.9,
          shipmentDate: 0.93,
          transportRef: 0.96,
        },
        unreadable: false,
      }),
    ],
    discrepancies: [
      {
        id: "replay-qty",
        severity: "Blocking",
        field: "quantity",
        label: "Quantity",
        valueA: "500",
        sourceA: "invoice_Acme_0042.pdf",
        valueB: "450",
        sourceB: "bill_of_lading.pdf",
        suggestion: "Confirm the correct quantity; check whether units match across documents.",
        resolved: true,
        resolvedValue: "500",
        resolvedReason: "Confirmed with the exporter.",
      },
      {
        id: "replay-weight",
        severity: "Blocking",
        field: "grossWeightKg",
        label: "Gross weight",
        valueA: "1200",
        sourceA: "invoice_Acme_0042.pdf",
        valueB: "1185",
        sourceB: "packing_list_photo.jpg",
        suggestion: "Confirm the correct gross weight in kilograms.",
        resolved: true,
        resolvedValue: "1200",
        resolvedReason: "Packing photo misread; reweighed at 1200 kg.",
      },
      {
        id: "replay-origin",
        severity: "Check",
        field: "originStatement",
        label: "Origin statement",
        valueA: "Goods wholly obtained in Ghana",
        sourceA: "invoice_Acme_0042.pdf",
        valueB: "Made in Ghana",
        sourceB: "packing_list_photo.jpg",
        suggestion: "Confirm which origin statement reflects the exporter's records.",
        resolved: false,
      },
      {
        id: "replay-desc",
        severity: "Note",
        field: "productDescription",
        label: "Product description",
        valueA: "Cotton bed linen sets, 100% cotton",
        sourceA: "invoice_Acme_0042.pdf",
        valueB: "Bed linen sets (cotton)",
        sourceB: "packing_list_photo.jpg",
        suggestion: "Check the descriptions refer to the same goods.",
        resolved: false,
      },
    ],
    unchecked: ["Only invoice_Acme_0042.pdf states net weight; could not cross-check."],
    messages: [
      msg(
        "replay-m1",
        "assistant",
        "Case opened. Upload 1–8 photos or PDFs and I will read them — no retyping needed.",
        0,
      ),
      msg(
        "replay-m2",
        "assistant",
        "Received 3 files. Reading them now — full report within a minute.",
        0,
      ),
      msg(
        "replay-m3",
        "assistant",
        "Got it — I recognised 3 documents: invoice_Acme_0042.pdf, packing_list_photo.jpg, bill_of_lading.pdf. Here is what I understood.",
        1,
      ),
      msg(
        "replay-m4",
        "assistant",
        [
          "Commercial invoice — invoice_Acme_0042.pdf",
          "Goods: Cotton bed linen sets, 100% cotton",
          "Qty: 500 sets | Weight: 1200 kg",
          "Value: 12400 USD",
          "From Accra Textile Mills Ltd to Nairobi Home Goods Ltd",
          "Refs: INV-2026-0042 / MAERSK 884102",
        ].join("\n"),
        1,
      ),
      msg(
        "replay-m5",
        "assistant",
        [
          "Packing list — packing_list_photo.jpg",
          "Goods: Bed linen sets (cotton)",
          "Qty: 500 sets | Weight: 1185 kg (check)",
          "Value: 12400 USD",
          "From Accra Textile Mills Ltd to Nairobi Home Goods Ltd",
          "Refs: INV-2026-0042 / MAERSK 884102",
        ].join("\n"),
        1,
      ),
      msg(
        "replay-m6",
        "assistant",
        [
          "Transport document — bill_of_lading.pdf",
          "Goods: Cotton bed linen, 45 cartons",
          "Qty: 450 sets | Weight: 1200 kg",
          "Value: — —",
          "From Accra Textile Mills Ltd to Nairobi Home Goods Ltd",
          "Refs: — / MAERSK 884102",
        ].join("\n"),
        1,
      ),
      msg("replay-m7", "assistant", "I found 4 disagreements across your documents:", 1),
      msg(
        "replay-m8",
        "assistant",
        [
          "⛔ Blocking: Quantity",
          '"500" (invoice_Acme_0042.pdf)',
          'vs "450" (bill_of_lading.pdf)',
          "Confirm the correct quantity; check whether units match across documents.",
        ].join("\n"),
        1,
      ),
      msg(
        "replay-m9",
        "assistant",
        [
          "⛔ Blocking: Gross weight",
          '"1200" (invoice_Acme_0042.pdf)',
          'vs "1185" (packing_list_photo.jpg)',
          "Confirm the correct gross weight in kilograms.",
        ].join("\n"),
        1,
      ),
      msg(
        "replay-m10",
        "assistant",
        [
          "⚠️ Check: Origin statement",
          '"Goods wholly obtained in Ghana" (invoice_Acme_0042.pdf)',
          'vs "Made in Ghana" (packing_list_photo.jpg)',
          "Confirm which origin statement reflects the exporter's records.",
        ].join("\n"),
        1,
      ),
      msg(
        "replay-m11",
        "assistant",
        [
          "ℹ️ Note: Product description",
          '"Cotton bed linen sets, 100% cotton" (invoice_Acme_0042.pdf)',
          'vs "Bed linen sets (cotton)" (packing_list_photo.jpg)',
          "Check the descriptions refer to the same goods.",
        ].join("\n"),
        1,
      ),
      msg(
        "replay-m12",
        "assistant",
        '2 blocking issues need your decision before this case can be approved. Reply with the correct value, e.g. "the total is 12,400".',
        1,
      ),
      msg(
        "replay-m13",
        "assistant",
        ["Could not check everything:", "• Only invoice_Acme_0042.pdf states net weight; could not cross-check."].join(
          "\n",
        ),
        1,
      ),
      msg(
        "replay-m14",
        "assistant",
        'Resolved Quantity: using "500". Noted: Confirmed with the exporter.',
        3,
      ),
      msg(
        "replay-m15",
        "assistant",
        'Resolved Gross weight: using "1200". Noted: Packing photo misread; reweighed at 1200 kg.',
        4,
      ),
      msg("replay-m16", "assistant", "All blocking issues are resolved. Status: ready.", 4),
      msg("replay-m17", "user", "What's missing for the AfCFTA preference check?", 5),
      msg(
        "replay-m18",
        "assistant",
        [
          "Origin evidence so far:",
          '• Invoice states: "Goods wholly obtained in Ghana"',
          '• Packing list states: "Made in Ghana"',
          "• Declared HS code: 6302.31 (bed linen)",
          "Still needed: your decision on the open origin-statement check above, confirmed from the exporter's records.",
          "Pre-check only — confirm rates and origin with the issuing authority and the gazetted tariff.",
        ].join("\n"),
        5,
      ),
    ],
    createdAt: at(0),
    updatedAt: at(5),
  };
}
