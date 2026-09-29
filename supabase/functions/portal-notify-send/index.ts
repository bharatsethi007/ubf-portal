// Portal customer notifications: emails what portal_notify_scan() queued.
// Cron (service role) calls this every hour in NZ daytime. One email per portal user, all their pending items batched.
//   config.test_recipient set  -> every email goes there instead (subject shows the real recipient). For testing.
//   config.email_enabled false -> nothing is sent; pending items are marked skipped so there's no backlog blast later.
// POST { dry?: true } — dry renders without sending or marking.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderDigest, subjectFor, type Item } from "./digestEmail.ts";

const PORTAL_URL = Deno.env.get("PORTAL_PUBLIC_URL") ?? "https://portal.ubfreight.com";
const REPLY_TO = Deno.env.get("PORTAL_NOTIFY_REPLY_TO") ?? "info.nz@ubfreight.com";

type Recipient = { email: string; name: string | null; account_id: string; customer: string | null; items: Item[] };
type Outbox = { config: { email_enabled: boolean; test_recipient: string | null }; ids: number[]; recipients: Recipient[] };

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function jwtRole(auth: string | null): string | null {
  try {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null;
  } catch { return null; }
}

// Legacy service_role JWT, or a new sb_secret_ key proven by an RPC only service_role may run.
async function isServiceCaller(auth: string | null): Promise<boolean> {
  if (jwtRole(auth) === "service_role") return true;
  const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
  if (!tok.startsWith("sb_secret_")) return false;
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } });
  const { error } = await probe.rpc("portal_notify_outbox", { p_limit: 1 });
  return !error;
}

async function send(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) { console.error("BREVO_API_KEY not set"); return false; }
  const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: from, name: "UB Freight" }, to: [{ email: to }], replyTo: { email: REPLY_TO }, subject, htmlContent: html, textContent: text }),
  });
  if (!r.ok) console.error("brevo", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  try {
    if (!(await isServiceCaller(req.headers.get("Authorization")))) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data, error } = await admin.rpc("portal_notify_outbox", { p_limit: 500 });
    if (error) throw error;
    const box = data as Outbox;
    if (!box.ids.length) return json({ pending: 0 });

    const test = box.config.test_recipient?.trim() || null;
    const live = box.config.email_enabled || !!test;
    const mails = box.recipients.map((r) => {
      const subject = subjectFor(r.items);
      const { html, text } = renderDigest(PORTAL_URL, r.name, r.customer, r.items);
      return { to: test ?? r.email, subject: test ? `[TEST to ${r.email}] ${subject}` : subject, html, text, items: r.items.length };
    });

    if (body?.dry) return json({ dry: true, live, pending: box.ids.length, emails: mails.map(({ html: _h, ...m }) => m) });

    if (!live) {
      await admin.rpc("portal_notify_mark", { p_ids: box.ids, p_status: "skipped" });
      return json({ pending: box.ids.length, sent: 0, skipped: "email disabled" });
    }

    let ok = 0, failed = 0;
    for (const m of mails) (await send(m.to, m.subject, m.html, m.text)) ? ok++ : failed++;
    // Items nobody wanted by email (all recipients opted out) are still marked, so the queue stays small.
    await admin.rpc("portal_notify_mark", { p_ids: box.ids, p_status: failed && !ok ? "failed" : "sent" });
    return json({ pending: box.ids.length, emails: mails.length, sent: ok, failed, test: !!test });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
