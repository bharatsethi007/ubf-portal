// Quote email threads: find the message to reply to, and log sent mail into the inbox linked to the quote.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { addr } from "../email-inbox-sync/graph.ts";

export type ThreadTarget = { conversationId: string; mailbox: string; graphId: string; threadId: string | null };

/** Latest inbound email in the conversation (fallback: latest of any direction). */
export async function threadTarget(db: SupabaseClient, conversationId: string): Promise<ThreadTarget | string> {
  const { data: conv } = await db.from("inbox_conversations").select("id, email_mailbox, email_thread_id").eq("id", conversationId).maybeSingle();
  if (!conv?.email_mailbox) return "That thread is not an email conversation";
  const { data: metas } = await db.from("inbox_email_meta")
    .select("graph_id, inbox_messages!inner(conversation_id, direction, created_at)")
    .eq("inbox_messages.conversation_id", conv.id).not("graph_id", "is", null);
  const rows = ((metas ?? []) as unknown as { graph_id: string; inbox_messages: { direction: string; created_at: string } }[])
    .sort((x, y) => (x.inbox_messages.created_at < y.inbox_messages.created_at ? 1 : -1));
  const target = rows.find((r) => r.inbox_messages.direction === "in") ?? rows[0];
  if (!target) return "No email to reply to in that thread";
  return { conversationId: conv.id, mailbox: conv.email_mailbox, graphId: target.graph_id, threadId: conv.email_thread_id ?? null };
}

/** Most recent email thread already linked to the quote, if any. */
export async function linkedThread(db: SupabaseClient, quoteId: string): Promise<string | null> {
  const { data } = await db.from("inbox_conversations").select("id")
    .eq("quote_id", quoteId).not("email_mailbox", "is", null).not("email_thread_id", "is", null)
    .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

type Sent = { id: string; internetMessageId?: string; conversationId?: string; subject?: string };

/** Mirror a sent mail into the inbox right away and link its thread to the quote. Never throws. */
export async function logSent(db: SupabaseClient, p: {
  quoteId: string; mailbox: string; sent: Sent; threadId: string | null; subject: string;
  to: string[]; cc: string[]; body: string; staffId: string; link?: boolean;
}): Promise<void> {
  try {
    if (!p.sent.internetMessageId) return;
    const { data: staffName } = await db.rpc("inbox_staff_name", { p_uid: p.staffId });
    const { data: res } = await db.rpc("inbox_ingest_email", { p: {
      mailbox: p.mailbox, graph_id: p.sent.id, internet_message_id: p.sent.internetMessageId,
      thread_id: p.threadId ?? p.sent.conversationId ?? null, subject: p.sent.subject ?? p.subject,
      from: { name: (staffName as string | null) ?? null, address: p.mailbox },
      to: p.to.map((a) => addr({ emailAddress: { address: a } })), cc: p.cc.map((a) => addr({ emailAddress: { address: a } })),
      at: new Date().toISOString(), body: p.body, outbound: true, sender_user_id: p.staffId,
    } });
    const conv = (res as { conversation_id?: string } | null)?.conversation_id;
    if (conv && p.link !== false) {
      await db.from("inbox_conversations").update({ quote_id: p.quoteId }).eq("id", conv).is("quote_id", null);
    }
  } catch (e) {
    console.warn("logSent", String(e).slice(0, 200));
  }
}
