// system-alerts (verify_jwt = false; own auth). pg_cron every 5 min.
// action "evaluate" (default): run alert rules, open/resolve system_alerts, email + bell for changes.
// action "test": send a test alert email + bell (staff only).
// Rules live in SQL (system_alert_candidates). This function only reconciles and notifies.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("system-alerts");

const PAGE = "https://console.ubfreight.com/setup/system-health";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Cand = { key: string; kind: string; severity: "warn" | "critical"; title: string; detail: string | null };
type Alert = Cand & { id: number; opened_at: string; resolved_at: string | null; notified_open_at: string | null };
type Settings = { enabled: boolean; emails: string[]; notify_resolved: boolean };
type Item = { state: "open" | "resolved"; a: Alert };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nz = (iso: string) =>
  new Date(iso).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dur = (a: string, b: string) => {
  const m = Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return m >= 1440 ? `${Math.round(m / 1440)}d` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

function renderEmail(items: Item[], test = false): { subject: string; html: string; text: string } {
  const open = items.filter((i) => i.state === "open");
  const crit = open.some((i) => i.a.severity === "critical");
  const head = test ? "Test alert" : open.length ? `${open.length} new alert${open.length > 1 ? "s" : ""}` : "All clear";
  const subject = test ? "[UBF] Test alert from System health"
    : open.length ? `[UBF] ${crit ? "Critical: " : ""}${open.map((i) => i.a.title).join(", ")}`.slice(0, 140)
    : `[UBF] Resolved: ${items.map((i) => i.a.title).join(", ")}`.slice(0, 140);
  const colour = (i: Item) => i.state === "resolved" ? "#16A34A" : i.a.severity === "critical" ? "#DC2626" : "#D97706";
  const label = (i: Item) => i.state === "resolved" ? "RESOLVED" : i.a.severity === "critical" ? "CRITICAL" : "WARNING";
  const rows = items.map((i) => `
<tr><td style="padding:0 0 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-left:4px solid ${colour(i)};border-radius:6px;">
<tr><td style="padding:12px 14px;font-family:Inter,Segoe UI,Arial,sans-serif;">
<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:${colour(i)};">${label(i)}</div>
<div style="font-size:15px;font-weight:600;color:#111827;margin:3px 0 4px;">${esc(i.a.title)}</div>
<div style="font-size:13px;color:#4B5563;line-height:19px;">${esc(i.a.detail ?? "")}</div>
<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#9CA3AF;margin-top:6px;">
${i.state === "resolved" && i.a.resolved_at ? `resolved ${nz(i.a.resolved_at)} · lasted ${dur(i.a.opened_at, i.a.resolved_at)}` : `started ${nz(i.a.opened_at)} NZ`}</div>
</td></tr></table></td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#F9FAFB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #E5E7EB;border-radius:10px;">
<tr><td style="padding:22px 24px 6px;font-family:Inter,Segoe UI,Arial,sans-serif;">
<div style="font-size:12px;color:#6B7280;">UBF Console · System health</div>
<div style="font-size:21px;font-weight:600;color:#111827;margin-top:4px;">${esc(head)}</div>
</td></tr>
<tr><td style="padding:14px 24px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:6px 24px 24px;"><a href="${PAGE}" style="display:inline-block;background:#111827;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:7px;">Open System health</a></td></tr>
</table>
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:#9CA3AF;margin-top:12px;">Change recipients in Setup › System health › Alerts.</div>
</td></tr></table></body></html>`;
  const text = [head, "", ...items.map((i) => `${label(i)}: ${i.a.title}\n${i.a.detail ?? ""}`), "", PAGE].join("\n");
  return { subject, html, text };
}

async function sendEmail(to: string[], e: { subject: string; html: string; text: string }): Promise<string | null> {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key || !to.length) return "no key or recipients";
  const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
  const r = await apiFetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: from, name: "UBF Alerts" }, to: to.map((email) => ({ email })),
      subject: e.subject, htmlContent: e.html, textContent: e.text }),
  });
  return r.ok ? null : `Brevo ${r.status}`;
}

async function recipients(db: SupabaseClient, emails: string[]): Promise<string[]> {
  const { data } = await db.from("staff_users").select("user_id, email, is_admin");
  const set = new Set(emails.map((e) => e.toLowerCase()));
  return (data ?? []).filter((u) => u.is_admin || set.has(String(u.email ?? "").toLowerCase())).map((u) => u.user_id as string);
}

async function bell(db: SupabaseClient, users: string[], items: Item[], test = false) {
  const rows = users.flatMap((uid) => items.map((i) => ({
    user_id: uid, kind: "system_alert",
    title: `${i.state === "resolved" ? "Resolved: " : i.a.severity === "critical" ? "Critical: " : ""}${i.a.title}`,
    body: i.a.detail, link: "/setup/system-health", actor_kind: "system",
    facts: { alert_id: i.a.id, state: i.state, severity: i.a.severity },
    dedupe_key: test ? null : `sysalert:${i.a.id}:${i.state}:${uid}`,
  })));
  for (const r of rows) await db.from("staff_notifications").insert(r);
}

async function evaluate(db: SupabaseClient) {
  const now = new Date().toISOString();
  const [{ data: s }, { data: cands, error: cErr }, { data: open }] = await Promise.all([
    db.from("system_alert_settings").select("enabled, emails, notify_resolved").maybeSingle(),
    db.rpc("system_alert_candidates"),
    db.from("system_alerts").select("*").is("resolved_at", null),
  ]);
  if (cErr) throw new Error(cErr.message);
  const settings = (s ?? { enabled: true, emails: [], notify_resolved: true }) as Settings;
  const want = new Map((cands as Cand[] ?? []).map((c) => [c.key, c]));
  const openByKey = new Map((open as Alert[] ?? []).map((a) => [a.key, a]));

  for (const [key, c] of want) {
    const a = openByKey.get(key);
    if (a) await db.from("system_alerts").update({ last_seen_at: now, severity: c.severity, detail: c.detail, title: c.title }).eq("id", a.id);
    else await db.from("system_alerts").insert({ ...c, opened_at: now, last_seen_at: now });
  }
  for (const [key, a] of openByKey) {
    if (!want.has(key)) await db.from("system_alerts").update({ resolved_at: now }).eq("id", a.id);
  }

  // What needs telling?
  const { data: toOpen } = await db.from("system_alerts").select("*").is("resolved_at", null).is("notified_open_at", null);
  const { data: toResolve } = await db.from("system_alerts").select("*")
    .not("resolved_at", "is", null).is("notified_resolved_at", null);
  const items: Item[] = [
    ...((toOpen ?? []) as Alert[]).map((a) => ({ state: "open" as const, a })),
    ...((toResolve ?? []) as Alert[]).filter((a) => a.notified_open_at && settings.notify_resolved)
      .map((a) => ({ state: "resolved" as const, a })),
  ];

  let emailError: string | null = null;
  if (items.length && settings.enabled) {
    emailError = await sendEmail(settings.emails, renderEmail(items));
    await bell(db, await recipients(db, settings.emails), items);
  }
  const openIds = ((toOpen ?? []) as Alert[]).map((a) => a.id);
  const resIds = ((toResolve ?? []) as Alert[]).map((a) => a.id);
  if (openIds.length) await db.from("system_alerts").update({ notified_open_at: now }).in("id", openIds);
  if (resIds.length) await db.from("system_alerts").update({ notified_resolved_at: now }).in("id", resIds);

  return { open: want.size, notified: items.length, email_error: emailError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let staffId: string | null = null;

  if (!(await isServiceCaller(req))) {
    const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await uc.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: st } = await uc.from("staff_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!st) return json({ error: "forbidden" }, 403);
    staffId = u.user.id;
  }

  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "test") {
      const { data: s } = await db.from("system_alert_settings").select("emails").maybeSingle();
      const fake: Alert = {
        id: 0, key: "test", kind: "test", severity: "warn", title: "Test alert",
        detail: "If you can read this, alert emails and the bell are working.",
        opened_at: new Date().toISOString(), resolved_at: null, notified_open_at: null,
      };
      const err = await sendEmail((s?.emails ?? []) as string[], renderEmail([{ state: "open", a: fake }], true));
      if (staffId) await bell(db, [staffId], [{ state: "open", a: fake }], true);
      return json({ ok: !err, error: err, to: s?.emails ?? [] });
    }
    return json({ ok: true, ...(await evaluate(db)) });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
