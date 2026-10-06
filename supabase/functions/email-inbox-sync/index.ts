// email-inbox-sync — mirrors shared mailboxes (inbox_email_sync rows) into the unified inbox.
// pg_cron every 2 min with the service key (verify_jwt=false, isServiceCaller gate).
// Body: {} = sync all enabled mailboxes | {"action":"probe","mailbox":"x@y"} = permission check, no writes.
// Never marks mail read or moves it: staff keep using Outlook alongside.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { setApiFn } from "../_shared/apiFetch.ts";
import { putObject } from "../_shared/s3.ts";
import { addr, attachmentBytes, graphToken, listAttachments, listSince, tokenRoles, type GMsg } from "./graph.ts";
setApiFn("email-inbox-sync");

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const PAGE = 25;
const BUDGET_MS = 110_000;
const MAX_ATT = 15 * 1024 * 1024;

function db(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

async function probe(token: string, mailbox: string) {
  const out: Record<string, unknown> = { roles: tokenRoles(token) };
  try {
    const m = await listSince(token, mailbox, new Date(Date.now() - 2 * 86400e3).toISOString(), 5);
    out.read = { ok: true, sample: m.length, subjects: m.map((x) => (x.subject ?? "").slice(0, 40)) };
  } catch (e) { out.read = { ok: false, error: String(e).slice(0, 300) }; }
  return out;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";

async function ingestOne(sb: SupabaseClient, token: string, mailbox: string, m: GMsg): Promise<string> {
  const imid = m.internetMessageId ?? m.id;
  const { data: seen } = await sb.from("inbox_messages").select("id").eq("source", "email").eq("source_id", imid).maybeSingle();
  if (seen?.id) return "duplicate";

  const from = addr(m.from);
  const internal = !!from.address && (from.address === mailbox.toLowerCase() || from.address.endsWith("@ubfreight.com"));
  const attachments: { name: string; content_type: string | null; size: number | null; s3_key: string }[] = [];
  if (m.hasAttachments) {
    const folder = `inbox/${safe(mailbox)}/${safe(imid)}`;
    for (const a of await listAttachments(token, mailbox, m.id)) {
      if (a.isInline || a["@odata.type"] !== "#microsoft.graph.fileAttachment" || (a.size ?? 0) > MAX_ATT) continue;
      const bytes = await attachmentBytes(token, mailbox, m.id, a.id);
      if (!bytes) continue;
      const path = `${folder}/${safe(a.name ?? "file")}`;
      try {
        await putObject(`booking-emails/${path}`, bytes, a.contentType ?? "application/octet-stream");
        attachments.push({ name: a.name ?? "file", content_type: a.contentType ?? null, size: a.size ?? null, s3_key: path });
      } catch (e) { console.error("attachment upload failed", e); }
    }
  }

  const { data, error } = await sb.rpc("inbox_ingest_email", { p: {
    mailbox: mailbox.toLowerCase(), graph_id: m.id, internet_message_id: imid, thread_id: m.conversationId ?? imid,
    subject: m.subject ?? "", from, to: (m.toRecipients ?? []).map(addr), cc: (m.ccRecipients ?? []).map(addr),
    at: m.receivedDateTime ?? m.sentDateTime ?? new Date().toISOString(),
    body: (m.uniqueBody?.content ?? "").trim().slice(0, 20000), full_text: (m.body?.content ?? "").slice(0, 60000),
    web_link: m.webLink ?? null, outbound: internal, attachments,
  } });
  if (error) throw new Error(`ingest ${imid}: ${error.message}`);
  return (data as { status?: string })?.status ?? "inserted";
}

async function syncMailbox(sb: SupabaseClient, token: string, row: { mailbox: string; cursor_at: string | null; backfill_days: number; backfilled_at: string | null }, t0: number) {
  let cursor = row.cursor_at ?? new Date(Date.now() - row.backfill_days * 86400e3).toISOString();
  const tally: Record<string, number> = {};
  let caughtUp = false;
  while (Date.now() - t0 < BUDGET_MS) {
    const page = await listSince(token, row.mailbox, cursor, PAGE);
    if (!page.length) { caughtUp = true; break; }
    let advanced = false;
    for (const m of page) {
      if (Date.now() - t0 > BUDGET_MS) break;
      const st = await ingestOne(sb, token, row.mailbox, m);
      tally[st] = (tally[st] ?? 0) + 1;
      const at = m.receivedDateTime ?? cursor;
      if (at > cursor) { cursor = at; advanced = true; }
    }
    await sb.from("inbox_email_sync").update({ cursor_at: cursor, last_run_at: new Date().toISOString(), last_error: null }).eq("mailbox", row.mailbox);
    if (page.length < PAGE) { caughtUp = true; break; }
    if (!advanced) break; // >PAGE mails share one timestamp; next run picks up after dedupe
  }
  if (caughtUp && !row.backfilled_at) await sb.rpc("inbox_email_finish_backfill", { p_mailbox: row.mailbox });
  return { mailbox: row.mailbox, cursor, caughtUp, ...tally };
}

Deno.serve(async (req: Request) => {
  if (!(await isServiceCaller(req))) return json({ error: "forbidden" }, 403);
  let body: { action?: string; mailbox?: string } = {};
  try { body = await req.json(); } catch { /* cron sends {} */ }
  if (body.action === "probe") return json(await probe(await graphToken(), body.mailbox ?? "imports.nz@ubfreight.com"));

  const sb = db();
  const t0 = Date.now();
  const { data: rows } = await sb.from("inbox_email_sync").select("mailbox,cursor_at,backfill_days,backfilled_at").eq("enabled", true);
  if (!rows?.length) return json({ ok: true, results: [], note: "no enabled mailboxes" });
  const token = await graphToken();
  const results = [];
  for (const row of rows ?? []) {
    try { results.push(await syncMailbox(sb, token, row, t0)); }
    catch (e) {
      console.error("sync failed", row.mailbox, e);
      await sb.from("inbox_email_sync").update({ last_error: String(e).slice(0, 500), last_run_at: new Date().toISOString() }).eq("mailbox", row.mailbox);
      results.push({ mailbox: row.mailbox, error: String(e).slice(0, 200) });
    }
  }
  return json({ ok: true, results });
});
