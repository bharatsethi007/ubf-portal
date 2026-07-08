// booking-email-ingest — poll Bookings.AI mailbox, extract via Claude, write draft bookings.
// Invoked by pg_cron every 5 min (service_role bearer). verify_jwt = false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractBooking } from "./extraction.ts";
import { markSourceFailed, markSourceRetry, writeDraft } from "./draftWriter.ts";
import {
  downloadAttachmentBytes,
  fetchUnreadMessages,
  getGraphToken,
  markMessageRead,
  senderAddress,
} from "./graphClient.ts";
import { messageBodyText } from "./htmlStrip.ts";
import { extractPdfText } from "./pdfText.ts";
import type { GraphAttachment, GraphMessage } from "./types.ts";
import { BUCKET, MAILBOX } from "./types.ts";

const MAX_ATTEMPTS = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Reject unless Authorization Bearer matches runtime SUPABASE_SERVICE_ROLE_KEY. */
function authorizeCron(req: Request): boolean {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  return !!expected && auth === `Bearer ${expected}`;
}

type SourceRow = { id: string; processing_status: string; attempt_count: number };

async function getExistingSource(
  db: ReturnType<typeof createClient>,
  messageId: string,
): Promise<SourceRow | null> {
  const { data } = await db
    .from("booking_source_emails")
    .select("id, processing_status, attempt_count")
    .eq("message_id", messageId)
    .maybeSingle();
  return data as SourceRow | null;
}

async function beginAttempt(
  db: ReturnType<typeof createClient>,
  msg: GraphMessage,
  ownerEmail: string | null,
  bodyText: string,
  existing: SourceRow | null,
): Promise<{ sourceId: string; attemptCount: number; poisoned: boolean }> {
  if (existing) {
    const attemptCount = (existing.attempt_count ?? 0) + 1;
    await db.from("booking_source_emails").update({
      attempt_count: attemptCount,
      forwarded_by: ownerEmail,
      subject: msg.subject ?? null,
      received_at: msg.receivedDateTime ?? null,
      raw_body: bodyText,
      error_detail: null,
    }).eq("id", existing.id);
    return {
      sourceId: existing.id,
      attemptCount,
      poisoned: attemptCount > MAX_ATTEMPTS,
    };
  }

  const { data, error } = await db.from("booking_source_emails").insert({
    message_id: msg.id,
    from_address: senderAddress(msg),
    forwarded_by: ownerEmail,
    subject: msg.subject ?? null,
    received_at: msg.receivedDateTime ?? null,
    raw_body: bodyText,
    processing_status: "pending",
    attempt_count: 1,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "source email insert failed");
  return { sourceId: data.id as string, attemptCount: 1, poisoned: false };
}

async function storeAttachments(
  db: ReturnType<typeof createClient>,
  token: string,
  msg: GraphMessage,
): Promise<{ paths: string[]; pdfTexts: string[]; notes: string[] }> {
  const paths: string[] = [];
  const pdfTexts: string[] = [];
  const notes: string[] = [];

  for (const att of msg.attachments ?? []) {
    if (!att.name) continue;
    const safeName = att.name.replace(/[^\w.\-()+ ]/g, "_");
    const storagePath = `${msg.id}/${safeName}`;
    const bytes = await downloadAttachmentBytes(token, msg.id, att);
    if (!bytes) {
      notes.push(`Could not download attachment ${att.name}`);
      continue;
    }

    const { error } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: att.contentType ?? "application/octet-stream",
      upsert: true,
    });
    if (error) {
      notes.push(`Storage upload failed for ${att.name}: ${error.message}`);
      continue;
    }
    paths.push(storagePath);

    if (isPdf(att)) {
      const { text, note } = await extractPdfText(bytes);
      if (text) pdfTexts.push(`[${att.name}]\n${text}`);
      else if (note) notes.push(`${att.name}: ${note}`);
    }
  }

  return { paths, pdfTexts, notes };
}

function isPdf(att: GraphAttachment): boolean {
  const ct = (att.contentType ?? "").toLowerCase();
  const name = (att.name ?? "").toLowerCase();
  return ct.includes("pdf") || name.endsWith(".pdf");
}

async function processMessage(
  db: ReturnType<typeof createClient>,
  token: string,
  msg: GraphMessage,
): Promise<{ ok: boolean; messageId: string; bookingId?: string; error?: string }> {
  const messageId = msg.id;
  const existing = await getExistingSource(db, messageId);
  if (existing?.processing_status === "extracted" || existing?.processing_status === "failed") {
    return { ok: true, messageId, error: "skipped: already processed" };
  }

  const ownerEmail = senderAddress(msg);
  const bodyText = messageBodyText(msg.body);
  const { sourceId, attemptCount, poisoned } = await beginAttempt(db, msg, ownerEmail, bodyText, existing);

  if (poisoned) {
    await markSourceFailed(db, sourceId, `max attempts exceeded (${MAX_ATTEMPTS})`);
    return { ok: false, messageId, error: "poisoned: max attempts exceeded" };
  }

  try {
    const { paths, pdfTexts, notes } = await storeAttachments(db, token, msg);
    if (paths.length) {
      await db.from("booking_source_emails").update({ attachment_paths: paths }).eq("id", sourceId);
    }

    const attachmentTexts = [...pdfTexts];
    if (notes.length) attachmentTexts.push(`Attachment notes:\n${notes.join("\n")}`);

    const extracted = await extractBooking(bodyText, attachmentTexts);
    const bookingId = await writeDraft(db, sourceId, ownerEmail, extracted, extracted);
    await markMessageRead(token, messageId);
    return { ok: true, messageId, bookingId };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (attemptCount >= MAX_ATTEMPTS) await markSourceFailed(db, sourceId, detail);
    else await markSourceRetry(db, sourceId, detail);
    return { ok: false, messageId, error: detail };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!authorizeCron(req)) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);

  const db = createClient(url, service);
  const started = Date.now();

  try {
    const graphToken = await getGraphToken();
    const messages = await fetchUnreadMessages(graphToken, 10);
    const results = [];

    for (const msg of messages) {
      results.push(await processMessage(db, graphToken, msg));
    }

    return json({
      ok: true,
      mailbox: MAILBOX,
      polled: messages.length,
      results,
      ms: Date.now() - started,
    });
  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - started,
    }, 500);
  }
});
