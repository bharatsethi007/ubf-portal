// email-html — Outlook-formatted body of one inbox email, fetched from Graph on first open and cached in S3.
// Body: { message_id, part?: 'full' }. Default returns { html: this email only, has_history }; part 'full' returns { html } with
// the quoted history (can be large, so only fetched when staff click "...").
// Inline images (signatures, logos) are embedded as data URIs so the page needs no further auth.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
import { getObject, putObject } from "../_shared/s3.ts";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { GRAPH, graphToken } from "../email-inbox-sync/graph.ts";
setApiFn("email-html");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const MAX_INLINE = 400_000;

// No scripts, no event handlers, no javascript: links. The client also renders inside a script-less sandbox.
function scrub(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/<meta[^>]*http-equiv[^>]*>/gi, "");
}

type GAttFull = { name?: string; contentType?: string; contentId?: string; size?: number; isInline?: boolean; contentBytes?: string };

async function fromGraph(mailbox: string, graphId: string): Promise<{ unique: string; full: string }> {
  const token = await graphToken();
  const base = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages/${graphId}`;
  const h = { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="html", IdType="ImmutableId"' };
  const res = await apiFetch(`${base}?$select=uniqueBody,body`, { headers: h });
  if (!res.ok) throw new Error(`Graph ${res.status}`);
  const m = await res.json() as { uniqueBody?: { content?: string }; body?: { content?: string } };
  let unique = m.uniqueBody?.content ?? "", full = m.body?.content ?? "";
  if (/cid:/i.test(unique + full)) {
    const a = await apiFetch(`${base}/attachments?$filter=isInline eq true`, { headers: h });
    const list = a.ok ? ((await a.json()).value ?? []) as GAttFull[] : [];
    for (const att of list) {
      if (!att.contentId || !att.contentBytes || (att.size ?? 0) > MAX_INLINE) continue;
      const cid = att.contentId.replace(/^<|>$/g, "");
      const uri = `data:${att.contentType ?? "image/png"};base64,${att.contentBytes}`;
      const re = new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
      unique = unique.replace(re, uri); full = full.replace(re, uri);
    }
  }
  return { unique: scrub(unique), full: scrub(full) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!(await isServiceCaller(req))) {
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
    const { data: u } = await user.auth.getUser();
    if (!u.user) return json({ error: "forbidden" }, 403);
    const { data: staff } = await sb.from("staff_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);
  }

  let b: { message_id?: number; part?: string };
  try { b = await req.json(); } catch { b = {}; }
  const id = Number(b.message_id);
  if (!id) return json({ error: "message_id required" }, 400);
  const { data: meta } = await sb.from("inbox_email_meta").select("mailbox,graph_id,html_key").eq("message_id", id).maybeSingle();
  if (!meta?.graph_id) return json({ error: "no_html" }, 404);

  const reply = (o: { unique: string; full: string }) => b.part === "full"
    ? json({ html: o.full || o.unique })
    : json({ html: o.unique || o.full, has_history: !!o.unique && o.full.length > o.unique.length + 400 });
  if (meta.html_key) {
    try { return reply(await (await getObject(`booking-emails/${meta.html_key}`)).json()); } catch { /* cache missing: refetch */ }
  }
  try {
    const out = await fromGraph(meta.mailbox, meta.graph_id);
    const key = `inbox-html/${meta.mailbox}/${id}.json`;
    await putObject(`booking-emails/${key}`, JSON.stringify(out), "application/json");
    await sb.from("inbox_email_meta").update({ html_key: key }).eq("message_id", id);
    return reply(out);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 502);
  }
});
