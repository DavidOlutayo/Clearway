import { CorrectionSchema, type CorrectionOutput } from "../../schemas";
import { getModelClient, modelName } from "../../model";

// Parses a plain-language correction ("the quantity is 500 cartons")
// into a structured field update. Returns null when the text is not a
// clear correction so the agent asks a follow-up instead of guessing.
export async function parseCorrection(
  userText: string,
  knownFields: string[],
): Promise<CorrectionOutput | null> {
  const client = getModelClient();
  const prompt = [
    "Parse a user's correction to shipment case fields.",
    `Known fields: ${knownFields.join(", ")}.`,
    "Reply with JSON only: { field, newValue, docFileName }.",
    "field must be one of the known fields. If the text is not a clear correction, reply {\"field\":\"\",\"newValue\":\"\"}.",
    `User text: ${userText}`,
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await client.chat.completions.create({
      model: modelName(),
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = CorrectionSchema.parse(JSON.parse(raw));
      if (!parsed.field || !parsed.newValue) return null;
      if (!knownFields.includes(parsed.field)) return null;
      return parsed;
    } catch {
      // Retry once, then fall through to null.
    }
  }
  return null;
}
