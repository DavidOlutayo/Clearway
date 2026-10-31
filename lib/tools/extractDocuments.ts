import type OpenAI from "openai";
import { ExtractionSchema, type ExtractionOutput } from "../../schemas";
import type { DocumentExtraction } from "../../types";
import { getModelClient, modelName } from "../../model";
import {
  extractPdfTextNaive,
  isImageMime,
  isSupportedMime,
  looksUnreadablePdf,
  toDataUrl,
} from "../../files";

export interface ExtractionInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

const SYSTEM_PROMPT = [
  "You read freight documents like a careful clerk.",
  "Extract only what is printed in the document. Never invent values.",
  "If a field is missing or illegible, omit it or use null and give it confidence 0.",
  "Give a 0-1 confidence for docType and for each extracted field.",
  "Classify docType as one of: commercial_invoice, packing_list, transport_document, supplier_invoice, unknown, unsupported.",
  "Weights: convert to kilograms when the unit is clear (1 lb = 0.453592 kg); otherwise give the number as printed and confidence below 0.8.",
  "Never convert currency. Keep dates and references exactly as printed.",
  "Reply with JSON only: { docType, docTypeConfidence, fields, fieldConfidence, unreadable, note }.",
].join(" ");

function toExtraction(output: ExtractionOutput): DocumentExtraction {
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
): Promise<{ extraction: DocumentExtraction; modelCalls: number; tokens: number }> {
  if (!isSupportedMime(input.mimeType)) {
    return {
      extraction: {
        docType: "unsupported",
        docTypeConfidence: 1,
        fields: {},
        fieldConfidence: {},
        unreadable: true,
        note: `${input.fileName} is not a supported photo or PDF; skipped.`,
      },
      modelCalls: 0,
      tokens: 0,
    };
  }

  if (input.mimeType.toLowerCase() === "application/pdf" && looksUnreadablePdf(input.buffer)) {
    return {
      extraction: unreadableResult(
        `${input.fileName} looks like a scanned PDF with no readable text; please send photos of its pages.`,
      ),
      modelCalls: 0,
      tokens: 0,
    };
  }

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } };

  const userParts: ContentPart[] = [
    { type: "text", text: `Read this document (${input.fileName}) and reply with JSON only.` },
  ];
  if (isImageMime(input.mimeType)) {
    userParts.push({
      type: "image_url",
      image_url: { url: toDataUrl(input.mimeType, input.buffer), detail: "high" },
    });
  } else {
    userParts.push({
      type: "text",
      text: `PDF text scan (may be incomplete; only use clearly printed values):\n${extractPdfTextNaive(input.buffer)}`,
    });
  }

  let lastError = "";
  let tokens = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await client.chat.completions.create({
      model: modelName(),
      temperature: 0,
      max_tokens: 1500,
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
      return { extraction: toExtraction(parsed), modelCalls: attempt + 1, tokens };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "invalid JSON";
    }
  }

  // Validate-then-retry-once; otherwise mark low-confidence (TECH_BRIEF 3).
  return {
    extraction: lowConfidenceFallback(
      `${input.fileName} was hard to read confidently; every field needs your check.`,
    ),
    modelCalls: 2,
    tokens,
  };
}

// One tool invocation covers the whole batch so an 8-file case stays
// inside the per-turn tool-call cap.
export async function extractDocuments(
  inputs: ExtractionInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ extractions: DocumentExtraction[]; modelCalls: number; tokens: number }> {
  const client = getModelClient();
  const extractions: DocumentExtraction[] = [];
  let modelCalls = 0;
  let tokens = 0;
  for (let index = 0; index < inputs.length; index++) {
    const result = await extractOne(client, inputs[index]);
    extractions.push(result.extraction);
    modelCalls += result.modelCalls;
    tokens += result.tokens;
    onProgress?.(index + 1, inputs.length);
  }
  return { extractions, modelCalls, tokens };
}
