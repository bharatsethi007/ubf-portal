// quote-email-send — STAFF. Emails a quote (PDF built in the browser) through Outlook (MS Graph).
// New chain: sent as the sales support mailbox. Reply: reply-all in an inbox email thread, as that thread's mailbox.
// Either way the sent mail is mirrored into the inbox and its thread linked to the quote (so reminders can continue it).
// Optional Accept / Decline buttons (same token flow as reminders). verify_jwt=true.
// Body: { quote_id, conversation_id?, to[], cc?[], subject?, text, pdf_base64?, pdf_name?, include_actions? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { cors, json, requireStaff } from "../booking-customer-notify/staffGate.ts";
import { setApiFn } from "../_shared/apiFetch.ts";
import { graphToken } from "../email-inbox-sync/graph.ts";
import { logSent, threadTarget } from "../_shared/quoteThread.ts";
import { sendAsMailbox, type OutAttachment } from "../booking-email-send/graphSend.ts";
import { renderQuoteEmailBody } from "../_shared/quoteEmail.ts";
import { replyAllHtml } from "./graphReply.ts";
setApiFn("quote-email-send");

const MAILBOX = Deno.env.get("QUOTE_REMINDER_MAILBOX") ?? "salessupport.nz@ubfreight.com";
const PORTAL = (Deno.env.get("PORTAL_URL") ?? "https://portal.ubfreight.com").replace(/\/+$/, "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (l?: string[]) => [...new Set((l ?? []).map((e) => e.trim().toLowerCase()).filter(isEmail))];
const MAX_PDF = 8 * 1024 * 1024;

type Body = {
  quote_id?: string; conversation_id?: string | null; to?: string[]; cc?: string[]; subject?: string; text?: string;
  pdf_base64?: string | null; pdf_name?: string | null; include_actions?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.response;
    const db = gate.db;
    const b = (await req.json().catch(() => ({}))) as Body;
    const to = clean(b.to), cc = clean(b.cc).filter((e) => !to.includes(e));
    const text = (b.text ?? "").trim();
    if (!b.quote_id) return json({ error: "quote_id required" }, 400);
    if (!to.length) return json({ error: "Add at least one valid To address" }, 400);
    if (!text) return json({ error: "Message is empty" }, 400);
    if (!b.conversation_id && !(b.subject ?? "").trim()) return json({ error: "Subject is required" }, 400);

    const { data: q } = await db.from("quotes").select("id, quote_no, status").eq("id", b.quote_id).maybeSingle();
    if (!q) return json({ error: "Quote not found" }, 404);

    const attachments: OutAttachment[] = [];
    if (b.pdf_base64) {
      const bytes = decodeBase64(b.pdf_base64);
      if (bytes.length > MAX_PDF) return json({ error: "PDF too large" }, 400);
      attachments.push({ name: (b.pdf_name || `${q.quote_no ?? "quotation"}.pdf`).replace(/[\\/:*?"<>|]/g, "-"), contentType: "application/pdf", bytes });
    }

    // Reply target: latest inbound email in the chosen thread.
    let mailbox = MAILBOX, graphId: string | null = null, threadId: string | null = null;
    if (b.conversation_id) {
      const t = await threadTarget(db, b.conversation_id);
      if (typeof t === "string") return json({ error: t }, 400);
      mailbox = t.mailbox; graphId = t.graphId; threadId = t.threadId;
    }
    // Test: every recipient is a UBF address. Links never change the quote, quote not marked sent.
    const test = [...to, ...cc].every((e) => e.endsWith("@ubfreight.com"));

    let actions = null;
    if (b.include_actions !== false && ["open", "published", "sent"].includes(q.status)) {
      const { data: opts } = await db.from("quote_responses").select("id")
        .eq("quote_id", q.id).gt("total_sell", 0).not("status", "in", "(rejected,withdrawn)").order("total_sell");
      if (opts?.length) {
        const { data: rm, error } = await db.from("quote_reminders")
          .insert({ quote_id: q.id, sent_to: to[0], sent_by: gate.staffId, mailbox, kind: test ? "test" : "quote" }).select("id, token").single();
        if (error || !rm) throw new Error(error?.message ?? "Could not create link");
        const base = `${PORTAL}/q/${rm.token}`;
        actions = { acceptUrl: `${base}?a=accept&r=${opts[0].id}`, declineUrl: `${base}?a=decline`, viewUrl: base, multi: opts.length > 1 };
      }
    }
    const html = renderQuoteEmailBody(text, actions);

    const token = await graphToken();
    try {
      if (graphId) {
        const sent = await replyAllHtml(token, mailbox, graphId, html, to, cc, attachments);
        await logSent(db, { quoteId: q.id, mailbox, sent, threadId, subject: sent.subject ?? "", to, cc, body: text, staffId: gate.staffId, link: !test });
      } else {
        const subject = b.subject!.trim();
        const sent = await sendAsMailbox(token, mailbox, { subject, html, to, cc, attachments });
        if (!test) await logSent(db, { quoteId: q.id, mailbox, sent, threadId: null, subject, to, cc, body: text, staffId: gate.staffId });
      }
    } catch (e) {
      const msg = String(e);
      const friendly = /ErrorAccessDenied|403/.test(msg) ? `Portal cannot send from ${mailbox} yet (Mail.Send access)` : msg.slice(0, 300);
      return json({ error: friendly }, 502);
    }

    if (!test) {
      await db.from("quotes").update({ last_reminded_at: new Date().toISOString() }).eq("id", q.id);
      await db.rpc("email_contacts_touch", { p_emails: [...to, ...cc], p_kind: "customer" }).then(() => null, () => null);
    }
    return json({ ok: true, from: mailbox, mode: graphId ? "reply" : "new", to, cc, test });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
