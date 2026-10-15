// quote-reminder-send — STAFF. Emails customers a reminder for open quotes with one-click Accept / Decline links.
// Sends through Outlook (MS Graph). Two ways per quote:
//   thread: reply-all in an existing email thread, from that thread's mailbox (default when the quote has a linked thread)
//   new:    fresh branded email from the sales support mailbox, owner in CC
// Test: any @ubfreight.com address. Goes to that address only (nobody on the thread), links never change the quote,
// quote not marked reminded. verify_jwt=true.
// Body: { items: [{ quote_id, email?, conversation_id?, pdf_base64?, pdf_name? }] }  (PDF is built in the browser)
//   email overrides the resolved contact. conversation_id: omitted = linked thread if any, "new" = new email, uuid = that thread.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, json, requireStaff } from "../booking-customer-notify/staffGate.ts";
import { setApiFn } from "../_shared/apiFetch.ts";
import { graphToken } from "../email-inbox-sync/graph.ts";
import { sendAsMailbox, type OutAttachment } from "../booking-email-send/graphSend.ts";
import { renderCustomerReminder, renderReminderReply } from "../_shared/quoteReminderEmail.ts";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { linkedThread, logSent, threadTarget } from "../_shared/quoteThread.ts";
import { replyAllHtml } from "../quote-email-send/graphReply.ts";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
setApiFn("quote-reminder-send");

const MAILBOX = Deno.env.get("QUOTE_REMINDER_MAILBOX") ?? "salessupport.nz@ubfreight.com";
// Public Accept / Decline page. No login. tracking.ubfreight.com serves the public pages (/t, /q).
const LINKS = (Deno.env.get("QUOTE_LINK_URL") ?? "https://tracking.ubfreight.com").replace(/\/+$/, "");
const MAX_PDF = 6 * 1024 * 1024;
const MAX = 50;
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isTest = (s: string) => s.endsWith("@ubfreight.com");
const LIVE = ["open", "published", "sent"];

type Item = { quote_id?: string; email?: string | null; conversation_id?: string | null; pdf_base64?: string | null; pdf_name?: string | null };
type Result = {
  quote_id: string; quote_no?: string | null; ok: boolean; to?: string; error?: string;
  mode?: "thread" | "new"; mailbox?: string; test?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    // Staff JWT normally. Service key allowed for admin tests (as_staff).
    const body = (await req.json().catch(() => ({}))) as { items?: Item[]; as_staff?: string };
    let gate: { staffId: string; db: SupabaseClient };
    if (await isServiceCaller(req)) {
      if (!body.as_staff) return json({ error: "as_staff required" }, 400);
      gate = { staffId: body.as_staff, db: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) };
    } else {
      const g = await requireStaff(req);
      if (!g.ok) return g.response;
      gate = g;
    }
    const items = (body.items ?? []).filter((i) => i.quote_id).slice(0, MAX);
    if (!items.length) return json({ error: "No quotes selected" }, 400);

    const token = await graphToken();
    const results: Result[] = [];
    for (const it of items) {
      try {
        results.push(await sendOne(gate.db, gate.staffId, token, it));
      } catch (e) {
        results.push({ quote_id: it.quote_id!, ok: false, error: String(e).slice(0, 200) });
      }
    }
    return json({ ok: true, from: MAILBOX, sent: results.filter((r) => r.ok).length, results });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});

async function sendOne(db: SupabaseClient, staffId: string, token: string, it: Item): Promise<Result> {
  const qid = it.quote_id!;
  const { data: q } = await db.from("quotes")
    .select("id, quote_no, status, shipment_type, customer_name, customer_account_id, contact_name, from_port_code, to_port_code, expires_at, created_by")
    .eq("id", qid).maybeSingle();
  if (!q) return { quote_id: qid, ok: false, error: "Quote not found" };
  const fail = (error: string, extra: Partial<Result> = {}): Result => ({ quote_id: qid, quote_no: q.quote_no, ok: false, error, ...extra });
  if (!LIVE.includes(q.status)) return fail(`Quote is ${q.status}`);

  let to = (it.email ?? "").trim().toLowerCase();
  if (!to) {
    const { data: e } = await db.rpc("quote_contact_email", { p_quote: qid });
    to = String(e ?? "").trim().toLowerCase();
  }
  if (!isEmail(to)) return fail("No customer email");
  const test = isTest(to);

  const { data: opts } = await db.from("quote_responses")
    .select("id, carrier, transit_time, transit_time_days, total_sell, currency, valid_till, status")
    .eq("quote_id", qid).gt("total_sell", 0).not("status", "in", "(rejected,withdrawn)").order("total_sell");
  if (!opts?.length) return fail("No priced options");

  // Where it goes: chosen thread, linked thread, or a new email.
  const want = it.conversation_id ?? null;
  const convId = want === "new" ? null : want ?? await linkedThread(db, qid);
  const target = convId ? await threadTarget(db, convId) : null;
  if (typeof target === "string") return fail(target);
  const mailbox = target?.mailbox ?? MAILBOX;

  const codes = [q.from_port_code, q.to_port_code].filter(Boolean) as string[];
  const { data: ports } = codes.length ? await db.from("ports").select("code, name").in("code", codes) : { data: [] };
  const pn = (c: string | null) => (c ? ports?.find((p: { code: string }) => p.code === c)?.name ?? c : "?");
  const lane = `${pn(q.from_port_code)} to ${pn(q.to_port_code)}`;

  const { data: owner } = q.created_by
    ? await db.from("staff_users").select("full_name, email").eq("user_id", q.created_by).maybeSingle()
    : { data: null };
  let contactName = test ? null : q.contact_name as string | null;
  if (!contactName && !test && q.customer_account_id) {
    const { data: c } = await db.from("contacts").select("first_name, email").eq("account_id", q.customer_account_id)
      .ilike("email", to).limit(1).maybeSingle();
    contactName = c?.first_name ?? null;
  }

  const attachments: OutAttachment[] = [];
  if (it.pdf_base64) {
    const bytes = decodeBase64(it.pdf_base64);
    if (bytes.length > MAX_PDF) return fail("Quote PDF too large");
    attachments.push({ name: (it.pdf_name || `${q.quote_no ?? "quotation"}.pdf`).replace(/[\\/:*?"<>|]/g, "-"), contentType: "application/pdf", bytes });
  }

  const { data: rm, error: rmErr } = await db.from("quote_reminders")
    .insert({ quote_id: qid, sent_to: to, sent_by: staffId, mailbox, kind: test ? "test" : "reminder" }).select("id, token").single();
  if (rmErr || !rm) throw new Error(rmErr?.message ?? "Could not create link");

  const base = `${LINKS}/q/${rm.token}`;
  const reminder = {
    contactName, customerName: q.customer_name, quoteNo: q.quote_no ?? "", lane, expiresAt: q.expires_at,
    // LCL co-loaders are never shown to customers.
    options: opts.map((o) => ({
      carrier: String(q.shipment_type ?? "").toUpperCase() === "LCL" ? null : o.carrier,
      transit_days: o.transit_time ?? (o.transit_time_days != null ? String(o.transit_time_days) : null),
      total: o.total_sell, currency: o.currency, valid_till: o.valid_till,
    })),
    acceptUrl: `${base}?a=accept&r=${opts[0].id}`, declineUrl: `${base}?a=decline`, viewUrl: base,
    ownerName: owner?.full_name ?? null, ownerEmail: owner?.email ?? null, pdfAttached: attachments.length > 0,
  };
  const ownerCc = owner?.email && owner.email.toLowerCase() !== to ? [owner.email.toLowerCase()] : [];
  const cc = test ? [] : ownerCc;
  const mode: "thread" | "new" = target ? "thread" : "new";

  try {
    if (target) {
      const sent = await replyAllHtml(token, target.mailbox, target.graphId, renderReminderReply(reminder), [to], cc, attachments, { onlyListed: test });
      if (!test) {
        await logSent(db, { quoteId: qid, mailbox: target.mailbox, sent, threadId: target.threadId, subject: sent.subject ?? "",
          to: [to], cc, body: `Reminder sent for quote ${q.quote_no} with Accept / Decline links.`, staffId });
      }
    } else {
      const mail = renderCustomerReminder(reminder);
      const subject = test ? `[TEST] ${mail.subject}` : mail.subject;
      const sent = await sendAsMailbox(token, MAILBOX, { subject, html: mail.html, to: [to], cc, attachments });
      if (!test) {
        await logSent(db, { quoteId: qid, mailbox: MAILBOX, sent, threadId: null, subject,
          to: [to], cc, body: `Reminder sent for quote ${q.quote_no} with Accept / Decline links.`, staffId });
      }
    }
  } catch (e) {
    const msg = /ErrorAccessDenied|403/.test(String(e)) ? `Portal cannot send from ${mailbox} yet (Mail.Send access)` : String(e).slice(0, 200);
    await db.from("quote_reminders").update({ error: msg }).eq("id", rm.id);
    return fail(msg, { to, mode, mailbox, test });
  }

  if (!test) {
    await db.from("quotes").update({ last_reminded_at: new Date().toISOString() }).eq("id", qid);
    await db.rpc("email_contacts_touch", { p_emails: [to], p_kind: "customer" }).then(() => null, () => null);
  }
  return { quote_id: qid, quote_no: q.quote_no, ok: true, to, mode, mailbox, test };
}
