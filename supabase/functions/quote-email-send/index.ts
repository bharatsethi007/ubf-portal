// quote-email-send — STAFF. Emails a quote (PDF built in the browser) through Outlook (MS Graph).
// New chain: sent as the sales support mailbox. Reply: reply-all in an inbox email thread, as that thread's mailbox.
// Optional Accept / Decline buttons (same token flow as reminders). verify_jwt=true.
// Body: { quote_id, conversation_id?, to[], cc?[], subject?, text, pdf_base64?, pdf_name?, include_actions? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { cors, json, requireStaff } from "../booking-customer-notify/staffGate.ts";
import { setApiFn } from "../_shared/apiFetch.ts";
import { addr, graphToken } from "../email-inbox-sync/graph.ts";
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
      const { data: conv } = await db.from("inbox_conversations").select("id, email_mailbox, email_thread_id").eq("id", b.conversation_id).maybeSingle();
      if (!conv?.email_mailbox) return json({ error: "That thread is not an email conversation" }, 400);
      const { data: metas } = await db.from("inbox_email_meta")
        .select("graph_id, inbox_messages!inner(conversation_id, direction, created_at)")
        .eq("inbox_messages.conversation_id", conv.id).not("graph_id", "is", null);
      const rows = ((metas ?? []) as unknown as { graph_id: string; inbox_messages: { direction: string; created_at: string } }[])
        .sort((x, y) => (x.inbox_messages.created_at < y.inbox_messages.created_at ? 1 : -1));
      const target = rows.find((r) => r.inbox_messages.direction === "in") ?? rows[0];
      if (!target) return json({ error: "No email to reply to in that thread" }, 400);
      mailbox = conv.email_mailbox; graphId = target.graph_id; threadId = conv.email_thread_id ?? null;
    }

    let actions = null;
    if (b.include_actions !== false && ["open", "published", "sent"].includes(q.status)) {
      const { data: opts } = await db.from("quote_responses").select("id")
        .eq("quote_id", q.id).gt("total_sell", 0).not("status", "in", "(rejected,withdrawn)").order("total_sell");
      if (opts?.length) {
        const { data: rm, error } = await db.from("quote_reminders")
          .insert({ quote_id: q.id, sent_to: to[0], sent_by: gate.staffId, mailbox, kind: "quote" }).select("id, token").single();
        if (error || !rm) throw new Error(error?.message ?? "Could not create link");
        const base = `${PORTAL}/q/${rm.token}`;
        actions = { acceptUrl: `${base}?a=accept&r=${opts[0].id}`, declineUrl: `${base}?a=decline`, viewUrl: base, multi: opts.length > 1 };
      }
    }
    const html = renderQuoteEmailBody(text, actions);

    const token = await graphToken();
    try {
      if (graphId) {
        const draft = await replyAllHtml(token, mailbox, graphId, html, to, cc, attachments);
        const { data: staffName } = await db.rpc("inbox_staff_name", { p_uid: gate.staffId });
        if (draft.internetMessageId) {
          await db.rpc("inbox_ingest_email", { p: {
            mailbox, graph_id: draft.id, internet_message_id: draft.internetMessageId, thread_id: threadId ?? draft.conversationId ?? null,
            subject: draft.subject ?? "", from: { name: (staffName as string | null) ?? null, address: mailbox },
            to: to.map((a) => addr({ emailAddress: { address: a } })), cc: cc.map((a) => addr({ emailAddress: { address: a } })),
            at: new Date().toISOString(), body: text, outbound: true, sender_user_id: gate.staffId,
          } });
        }
      } else {
        await sendAsMailbox(token, mailbox, { subject: b.subject!.trim(), html, to, cc, attachments });
      }
    } catch (e) {
      const msg = String(e);
      const friendly = /ErrorAccessDenied|403/.test(msg) ? `Portal cannot send from ${mailbox} yet (Mail.Send access)` : msg.slice(0, 300);
      return json({ error: friendly }, 502);
    }

    await db.from("quotes").update({ last_reminded_at: new Date().toISOString() }).eq("id", q.id);
    await db.rpc("email_contacts_touch", { p_emails: [...to, ...cc], p_kind: "customer" }).then(() => null, () => null);
    return json({ ok: true, from: mailbox, mode: graphId ? "reply" : "new", to, cc });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
