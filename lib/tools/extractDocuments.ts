import type OpenAI from "openai";
import { ExtractionSchema, type DocumentOutput } from "../schemas";
import type { DocumentExtraction } from "../types";
import { getModelClient, modelName } from "../model";
import {
  extractPdfText,
  isImageMime,
  isSupportedMime,
  toDataUrl,
} from "../files";

export interface ExtractionInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

const SYSTEM_PROMPT = [
  "You read freight documents like a careful clerk.",
  "Extract only what is printed in the document. Never invent values.",
  "One file can hold several logical documents (for example an invoice followed by a packing list). Extract EACH logical document separately. A multi-page invoice is still ONE document; split only genuinely different documents.",
  "If a field is missing or illegible, omit it or use null and give it confidence 0.",
  "Give a 0-1 confidence for docType and for each extracted field.",
  "Classify docType as one of: commercial_invoice, packing_list, transport_document, supplier_invoice, unknown, unsupported.",
  "Weights: convert to kilograms when the unit is clear (1 lb = 0.453592 kg); otherwise give the number and confidence below 0.8.",
  "Write quantity, weights and totalValue as plain JSON numbers with no commas, currency symbols or units.",
  "Use these exact field names in fields (omit missing ones, never invent others): exporter, importer, productDescription, quantity, quantityUnit, grossWeightKg, netWeightKg, totalValue, currency, invoiceDate, shipmentDate, deliveryTerms, transportMode, transportRef, invoiceRef, originStatement, declaredHsCode. Use the same names in fieldConfidence.",
  "Never convert currency. Keep dates and references exactly as printed.",
  "Reply with JSON only: { documents: [ { docType, docTypeConfidence, fields, fieldConfidence, unreadable, note }, ... ] }. One item per logical document; a single document means one item.",
].join(" ");

function toExtraction(output: DocumentOutput): DocumentExtraction {
  return {
    docType: output.docType,
    docTypeConfidence: output.docTypeConfidence,
    fields: output.fields ?? {},
    fieldConfidence: output.fieldConfidence ?? {},
    unreadable: output.unreadable ?? false,
    note: output.note ?? null,
  };
}

function lowConfidenceFallback(note: string): DocumentExtraction {
  return {
    docType: "unknown",
    docTypeConfidence: 0,
    fields: {},
    fieldConfidence: {},
    unreadable: false,
    note,
  };
}

function unreadableResult(note: string): DocumentExtraction {
  return {
    docType: "unknown",
    docTypeConfidence: 0,
    fields: {},
    fieldConfidence: {},
    unreadable: true,
    note,
  };
}

async function extractOne(
  client: OpenAI,
  input: ExtractionInput,
): Promise<{ extractions: DocumentExtraction[]; modelCalls: number; tokens: number }> {
  if (!isSupportedMime(input.mimeType)) {
    return {
      extractions: [
        {
          docType: "unsupported",
          docTypeConfidence: 1,
          fields: {},
          fieldConfidence: {},
          unreadable: true,
          note: `${input.fileName} is not a supported photo or PDF; skipped.`,
        },
      ],
      modelCalls: 0,
      tokens: 0,
    };
  }

  let pdfText: string | null = null;
  if (input.mimeType.toLowerCase() === "application/pdf") {
    pdfText = await extractPdfText(input.buffer);
    if (pdfText.replace(/\s/g, "").length < 50) {
      return {
        extractions: [
          unreadableResult(
            `${input.fileName} has no readable text layer; please send photos of its pages.`,
          ),
        ],
        modelCalls: 0,
        tokens: 0,
      };
    }
  }

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } };

  const userParts: ContentPart[] = [
    { type: "text", text: `Read this file (${input.fileName}); it may hold several logical documents. Reply with JSON only.` },
  ];
  if (isImageMime(input.mimeType)) {
    userParts.push({
      type: "image_url",
      image_url: { url: toDataUrl(input.mimeType, input.buffer), detail: "high" },
    });
  } else {
    userParts.push({
      type: "text",
      text: `PDF text extraction (only use clearly printed values):\n${pdfText ?? ""}`,
    });
  }

  let lastError = "";
  let tokens = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await client.chat.completions.create({
      model: modelName(),
      temperature: 0,
      // Headroom above the model's thinking tokens; too small a budget
      // truncates the JSON answer (finish_reason length) every time.
      // Sized for multi-document files, whose answers run longer.
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: lastError
            ? [...userParts, { type: "text" as const, text: `Previous reply failed validation: ${lastError}. Reply with valid JSON only.` }]
            : userParts,
        },
      ],
    });
    tokens += completion.usage?.total_tokens ?? 0;
    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = ExtractionSchema.parse(JSON.parse(raw));
      return { extractions: parsed.documents.map(toExtraction), modelCalls: attempt + 1, tokens };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "invalid JSON";
    }
  }

  // Validate-then-retry-once; otherwise mark low-confidence (TECH_BRIEF 3).
  return {
    extractions: [
      lowConfidenceFallback(
        `${input.fileName} was hard to read confidently; every field needs your check.`,
      ),
    ],
    modelCalls: 2,
    tokens,
  };
}

// One tool invocation covers the whole batch so an 8-file case stays
// inside the per-turn tool-call cap. Returns one extraction array per
// input file, since a file can hold several logical documents.
export async function extractDocuments(
  inputs: ExtractionInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ extractions: DocumentExtraction[][]; modelCalls: number; tokens: number }> {
  const client = getModelClient();
  const extractions: DocumentExtraction[][] = [];
  let modelCalls = 0;
  let tokens = 0;
  for (let index = 0; index < inputs.length; index++) {
    const result = await extractOne(client, inputs[index]);
    extractions.push(result.extractions);
    modelCalls += result.modelCalls;
    tokens += result.tokens;
    onProgress?.(index + 1, inputs.length);
  }
  return { extractions, modelCalls, tokens };
}
