// email-reply — staff reply-all from the unified inbox, sent as the shared mailbox (lands in its Sent Items).
// verify_jwt=true + staff check. Body: { conversation_id, text }. Mirrors the sent mail into the inbox right away;
// email-inbox-sync later sees the same internetMessageId and skips it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { setApiFn } from "../_shared/apiFetch.ts";
import { addr, graphToken, replyAll } from "../email-inbox-sync/graph.ts";
setApiFn("email-reply");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: u } = await user.auth.getUser();
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!u.user) return json({ error: "forbidden" }, 403);
  const { data: staff } = await sb.from("staff_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!staff) return json({ error: "forbidden" }, 403);

  let body: { conversation_id?: string; text?: string };
  try { body = await req.json(); } catch { body = {}; }
  const text = String(body.text ?? "").trim();
  if (!body.conversation_id || !text) return json({ error: "conversation_id and text required" }, 400);

  const { data: conv } = await sb.from("inbox_conversations").select("id,email_mailbox,email_thread_id").eq("id", body.conversation_id).maybeSingle();
  if (!conv?.email_mailbox) return json({ error: "Not an email conversation" }, 400);

  // Reply to the latest inbound email in the thread (fallback: latest email of any direction).
  const { data: metas } = await sb.from("inbox_email_meta")
    .select("graph_id, inbox_messages!inner(conversation_id, direction, created_at)")
    .eq("inbox_messages.conversation_id", conv.id).not("graph_id", "is", null);
  const rows = ((metas ?? []) as unknown as { graph_id: string; inbox_messages: { direction: string; created_at: string } }[])
    .sort((a, b) => (a.inbox_messages.created_at < b.inbox_messages.created_at ? 1 : -1));
  const target = rows.find((r) => r.inbox_messages.direction === "in") ?? rows[0];
  if (!target) return json({ error: "No email to reply to" }, 400);

  try {
    const token = await graphToken();
    const draft = await replyAll(token, conv.email_mailbox, target.graph_id, text);
    const imid = draft.internetMessageId;
    const { data: staffName } = await sb.rpc("inbox_staff_name", { p_uid: u.user.id });
    if (imid) {
      await sb.rpc("inbox_ingest_email", { p: {
        mailbox: conv.email_mailbox, graph_id: draft.id, internet_message_id: imid, thread_id: conv.email_thread_id ?? draft.conversationId ?? null,
        subject: draft.subject ?? "", from: { name: (staffName as string | null) ?? null, address: conv.email_mailbox },
        to: (draft.toRecipients ?? []).map(addr), cc: (draft.ccRecipients ?? []).map(addr),
        at: new Date().toISOString(), body: text, outbound: true, sender_user_id: u.user.id,
      } });
    }
    return json({ ok: true });
  } catch (e) {
    const msg = String(e);
    const friendly = /ErrorAccessDenied|403/.test(msg)
      ? "Portal is not allowed to send from this mailbox yet (Mail.Send permission needed)."
      : msg.slice(0, 300);
    return json({ error: friendly }, 502);
  }
});
