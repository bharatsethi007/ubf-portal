// supabase/functions/tms-doc-email/index.ts
// STAFF (verify_jwt = true). Sends TMS consignment documentation email via Brevo.
// Generic sender: caller supplies the rendered HTML + PDF attachments (base64).
// Body: {
//   consignment_id?: uuid,          // for audit logging
//   to: string,                     // primary recipient
//   cc?: string[],                  // extra recipients
//   subject: string,
//   html: string,                   // full HTML email (built client-side via buildDocEmailHtml)
//   attachments?: { name: string; content: string }[]  // content = base64 (no data: prefix)
//   event_code?: string             // defaults TMS_DOC_EMAIL
// }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const isEmail = (s: unknown) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // ── verify caller is a staff user ──
    const rls = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const ures = await rls.auth.getUser();
    const user = ures.data.user;
    if (!user) return json({ error: "unauthorized" }, 401);
    const staff = await rls.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!staff.data) return json({ error: "forbidden_not_staff" }, 403);

    const body = await req.json().catch(() => null) as
      | { consignment_id?: string; to?: string; cc?: string[]; subject?: string; html?: string;
          attachments?: { name: string; content: string }[]; event_code?: string }
      | null;
    if (!body) return json({ error: "bad_json" }, 400);

    const to = (body.to ?? "").trim();
    const subject = (body.subject ?? "").trim();
    const html = body.html ?? "";
    if (!isEmail(to)) return json({ error: "invalid_to" }, 400);
    if (!subject) return json({ error: "missing_subject" }, 400);
    if (!html) return json({ error: "missing_html" }, 400);

    const cc = (Array.isArray(body.cc) ? body.cc : [])
      .map((e) => (e ?? "").trim()).filter(isEmail).filter((e) => e !== to);
    const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
      .filter((a) => a && typeof a.name === "string" && typeof a.content === "string" && a.content.length > 0)
      .slice(0, 6)
      .map((a) => ({ name: a.name, content: a.content }));

    const key = Deno.env.get("BREVO_API_KEY");
    if (!key) return json({ error: "email_not_configured" }, 500);
    const from = Deno.env.get("TMS_FROM_EMAIL") ?? Deno.env.get("SLI_FROM_EMAIL") ?? "no-reply@ubfreight.com";

    const payload: Record<string, unknown> = {
      sender: { email: from, name: "UB Freight" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };
    if (cc.length) payload.cc = cc.map((email) => ({ email }));
    if (attachments.length) payload.attachment = attachments;

    let emailStatus: "sent" | "failed" = "failed";
    let detail: string | undefined;
    try {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      emailStatus = r.ok ? "sent" : "failed";
      if (!r.ok) detail = `brevo_${r.status}: ${(await r.text()).slice(0, 300)}`;
    } catch (e) {
      detail = `send_error: ${String(e).slice(0, 200)}`;
    }

    // ── best-effort audit log ──
    try {
      const svc = createClient(url, service);
      await svc.from("tms_events").insert({
        consignment_id: body.consignment_id ?? null,
        event_code: body.event_code || "TMS_DOC_EMAIL",
        actor: user.id,
        note: emailStatus === "sent" ? `Documentation emailed to ${to}` : `Documentation email failed (${to})`,
        meta: {
          staff_email: user.email ?? null,
          to, cc, subject,
          attachments: attachments.map((a) => a.name),
          email_status: emailStatus,
          ...(detail ? { detail } : {}),
        },
      });
    } catch { /* logging is non-fatal */ }

    if (emailStatus !== "sent") return json({ email_status: emailStatus, detail }, 502);
    return json({ email_status: emailStatus, to, cc, attachments: attachments.map((a) => a.name) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
