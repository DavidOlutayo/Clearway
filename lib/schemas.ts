import { z } from "zod";

export const DocTypeSchema = z.enum([
  "commercial_invoice",
  "packing_list",
  "transport_document",
  "supplier_invoice",
  "unknown",
  "unsupported",
]);

const nullableString = z.string().nullable().optional();

// Model outputs vary in harmless ways ("500", "12,400", "1200 kg").
// Clean them into the typed shape: a single quirky field must never
// reject the whole extraction and blank the UI card.
function cleanNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function cleanConfidence(value: unknown): number {
  const num =
    typeof value === "string" && value.trim() !== ""
      ? Number(value.replace(/[^0-9.\-]/g, ""))
      : value;
  if (typeof num === "number" && Number.isFinite(num)) {
    if (num >= 0 && num <= 1) return num;
    if (num > 1 && num <= 100) return num / 100;
  }
  return 0;
}

function cleanUnreadable(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  if (Array.isArray(value)) return value.some((entry) => cleanUnreadable(entry));
  return false;
}

const nullableNumber = z.preprocess(cleanNumber, z.number().nullable().optional());
const confidence = z.preprocess(cleanConfidence, z.number().min(0).max(1));

// Canonical CaseFacts keys plus the aliases the model reaches for.
// Unknown keys are stripped by zod, which used to blank the UI card
// when the model wrote e.g. "qty" instead of "quantity": exact keys
// always win, aliases only fill gaps.
const CANONICAL_FIELD_KEYS = new Set([
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
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_ALIASES: Record<string, string> = {
  seller: "exporter",
  vendor: "exporter",
  buyer: "importer",
  consignee: "importer",
  customer: "importer",
  description: "productDescription",
  product: "productDescription",
  goods: "productDescription",
  commodity: "productDescription",
  qty: "quantity",
  unit: "quantityUnit",
  units: "quantityUnit",
  uom: "quantityUnit",
  weight: "grossWeightKg",
  grossweight: "grossWeightKg",
  weightkg: "grossWeightKg",
  netweight: "netWeightKg",
  total: "totalValue",
  value: "totalValue",
  amount: "totalValue",
  totalamount: "totalValue",
  totalvalue: "totalValue",
  ccy: "currency",
  date: "invoiceDate",
  issuedate: "invoiceDate",
  shipdate: "shipmentDate",
  shippeddate: "shipmentDate",
  bl: "transportRef",
  billoflading: "transportRef",
  awb: "transportRef",
  trackingnumber: "transportRef",
  shipmentref: "transportRef",
  transportno: "transportRef",
  invoiceno: "invoiceRef",
  invoicenumber: "invoiceRef",
  origin: "originStatement",
  countryoforigin: "originStatement",
  hscode: "declaredHsCode",
  hs: "declaredHsCode",
  tariffcode: "declaredHsCode",
  commoditycode: "declaredHsCode",
  incoterms: "deliveryTerms",
  incoterm: "deliveryTerms",
  mode: "transportMode",
};

function mapKeysToCanonical(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = { ...input };
  for (const [key, entry] of Object.entries(input)) {
    if (CANONICAL_FIELD_KEYS.has(key)) continue;
    const canonical = FIELD_ALIASES[normalizeKey(key)];
    if (canonical && !(canonical in output)) output[canonical] = entry;
  }
  return output;
}

const DOCTYPE_ALIASES: Record<string, string> = {
  invoice: "commercial_invoice",
  commercialinvoice: "commercial_invoice",
  packing: "packing_list",
  packinglist: "packing_list",
  packingslip: "packing_list",
  transportdocument: "transport_document",
  billoflading: "transport_document",
  bl: "transport_document",
  bol: "transport_document",
  awb: "transport_document",
  airwaybill: "transport_document",
  seawaybill: "transport_document",
  cmr: "transport_document",
  supplierinvoice: "supplier_invoice",
  purchaseinvoice: "supplier_invoice",
};

function mapDocTypeAlias(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return DOCTYPE_ALIASES[normalizeKey(value)] ?? value;
}

// Every field stays optional: the model extracts what is there and
// never invents values. Missing fields are null/undefined, not guesses.
export const CaseFactsSchema = z
  .object({
    exporter: nullableString,
    importer: nullableString,
    productDescription: nullableString,
    quantity: nullableNumber,
    quantityUnit: nullableString,
    grossWeightKg: nullableNumber,
    netWeightKg: nullableNumber,
    totalValue: nullableNumber,
    currency: nullableString,
    invoiceDate: nullableString,
    shipmentDate: nullableString,
    deliveryTerms: nullableString,
    transportMode: nullableString,
    transportRef: nullableString,
    invoiceRef: nullableString,
    originStatement: nullableString,
    declaredHsCode: nullableString,
  })
  .partial()
  .nullable();

export const DocumentSchema = z.object({
  docType: z.preprocess(mapDocTypeAlias, DocTypeSchema),
  docTypeConfidence: confidence,
  fields: z.preprocess(mapKeysToCanonical, CaseFactsSchema),
  fieldConfidence: z.preprocess(mapKeysToCanonical, z.record(confidence)).optional().default({}).catch({}),
  unreadable: z.preprocess(cleanUnreadable, z.boolean()).optional().default(false),
  note: z.string().nullable().optional().catch(null),
});

export type DocumentOutput = z.infer<typeof DocumentSchema>;

// One file can hold several logical documents (invoice + packing list
// scanned together). The model returns them as an array; a lone
// single-document reply is wrapped automatically.
export const ExtractionSchema = z.preprocess(
  (value) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !("documents" in value)) {
      return { documents: [value] };
    }
    return value;
  },
  z.object({ documents: z.array(DocumentSchema).min(1) }),
);

export type ExtractionOutput = z.infer<typeof ExtractionSchema>;

export const CorrectionSchema = z.object({
  field: z.string().min(1),
  newValue: z.string().min(1),
  docFileName: z.string().nullable().optional(),
});

export type CorrectionOutput = z.infer<typeof CorrectionSchema>;
