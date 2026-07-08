import type { BookingExtract } from "./types.ts";
import { CLAUDE_MODEL } from "./types.ts";
import { FIELD_SCHEMA, PARTY_GOODS_RULES, SYSTEM_PROMPT, USER_PREAMBLE } from "./extractionPrompt.ts";

function parseJsonPayload(text: string): BookingExtract {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw) as BookingExtract;
}

export async function extractBooking(
  emailBody: string,
  attachmentTexts: string[],
): Promise<BookingExtract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const attachmentBlock = attachmentTexts.length
    ? "\n\n--- ATTACHED DOCUMENT TEXT ---\n" + attachmentTexts.join("\n\n---\n")
    : "";

  const userContent =
    USER_PREAMBLE + FIELD_SCHEMA + PARTY_GOODS_RULES +
    "--- EMAIL BODY ---\n" + emailBody + attachmentBlock;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const block = json.content?.find((c: { type: string }) => c.type === "text");
  if (!block?.text) throw new Error("Claude response missing text block");
  return parseJsonPayload(block.text as string);
}
