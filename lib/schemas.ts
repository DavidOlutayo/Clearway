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
const nullableNumber = z.number().nullable().optional();

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
  .partial();

export const ExtractionSchema = z.object({
  docType: DocTypeSchema,
  docTypeConfidence: z.number().min(0).max(1),
  fields: CaseFactsSchema,
  fieldConfidence: z.record(z.number().min(0).max(1)).optional().default({}),
  unreadable: z.boolean().optional().default(false),
  note: z.string().nullable().optional(),
});

export type ExtractionOutput = z.infer<typeof ExtractionSchema>;

export const CorrectionSchema = z.object({
  field: z.string().min(1),
  newValue: z.string().min(1),
  docFileName: z.string().nullable().optional(),
});

export type CorrectionOutput = z.infer<typeof CorrectionSchema>;
