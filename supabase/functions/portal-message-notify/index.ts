// Emails the team inbox when a customer sends a portal message. Called by the portal_messages trigger (service role).
// POST { message_id, dry?: true }. Staff answer in console Messages; the customer sees replies in the portal.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { esc, renderNotify } from "../portal-booking-notify/notifyEmail.ts";

const CONSOLE_URL = "https://console.ubfreight.com";
const INBOX: Record<string, { email: string; team: string }> = {
  IS: { email: "importsea.nz@ubfreight.com", team: "Import Sea" },
  ES: { email: "exportsea.nz@ubfreight.com", team: "Export Sea" },
  IA: { email: "importair.nz@ubfreight.com", team: "Import Air" },
  EA: { email: "exportair.nz@ubfreight.com", team: "Export Air" },
};
const FALLBACK = { email: "info.nz@ubfreight.com", team: "UB Freight" };

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function jwtRole(auth: string | null): string | null {
  try {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null;
  } catch { return null; }
}
async function isServiceCaller(auth: string | null): Promise<boolean> {
  if (jwtRole(auth) === "service_role") return true;
  const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
  if (!tok.startsWith("sb_secret_")) return false;
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } });
  const { error } = await probe.rpc("portal_message_notify_payload", { p_message: 0 });
  return !error;
}
const title = (s?: string | null) => (s ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Ltd|Nz)\b/g, (m) => m.toUpperCase()) : null);

Deno.serve(async (req) => {
  try {
    if (!(await isServiceCaller(req.headers.get("Authorization")))) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.message_id);
    if (!Number.isFinite(id) || id <= 0) return json({ error: "message_id required" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: m, error } = await admin.rpc("portal_message_notify_payload", { p_message: id });
    if (error) throw error;
    if (!m) return json({ skipped: "not a customer message" });

    const box = INBOX[m.module ?? ""] ?? FALLBACK;
    const who = title(m.customer) ?? m.account_id;
    const ref = m.shipment_no ? `shipment ${m.shipment_no}` : m.booking_ref ? `booking ${m.booking_ref}` : null;
    const subject = `Portal message from ${who}${ref ? ` about ${ref}` : ""}: ${m.subject}`;
    const email = {
      preheader: String(m.body).slice(0, 120),
      eyebrow: `${box.team} · Portal message`,
      title: m.is_first ? `New conversation from ${who}` : `${who} replied`,
      intro: [`<strong>${esc(m.sender_name ?? "Customer")}</strong> wrote:`, esc(String(m.body)).replace(/\n/g, "<br>")],
      callout: null,
      facts: [["Customer", `${who} (${m.account_id})`], ["From", m.sender_email], ["Subject", m.subject], ["About", ref]] as [string, string | null][],
      button: { label: "Reply in console", url: `${CONSOLE_URL}/messages?t=${m.thread_id}` },
      footer: "Reply in the console so the customer sees it in their portal. Replying to this email will not reach them.",
    };
    if (body?.dry) return json({ dry: true, to: box.email, subject, text: renderNotify(email).text });

    const key = Deno.env.get("BREVO_API_KEY");
    if (!key) return json({ error: "BREVO_API_KEY not set" }, 500);
    const { html, text } = renderNotify(email);
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com", name: "UBF Portal" },
        to: [{ email: Deno.env.get("PORTAL_BOOKING_ALERT_TO") || box.email }], subject, htmlContent: html, textContent: text,
      }),
    });
    if (!r.ok) console.error("brevo", r.status, await r.text());
    return json({ sent: r.ok, to: box.email });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
