// rate-request-send — sends a saved rate request to each recipient via Brevo,
// one email per recipient, writing Brevo's messageId back to
// rate_request_recipients.email_message_id for later linking.
// Auth: in-function via requireStaff (deployed with verify_jwt=false so the
// browser CORS preflight passes). Required secrets: BREVO_API_KEY,
// BREVO_SENDER_EMAIL (verified Brevo sender), BREVO_SENDER_NAME (optional).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, json, requireStaff } from "../_shared/portalCommon.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("rate-request-send");

const BREVO = "https://api.brevo.com/v3/smtp/email";

type Recipient = { id: string; email: string; name: string | null };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireStaff(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  let payload: { requestId?: string };
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const requestId = payload.requestId;
  if (!requestId) return json({ error: "missing requestId" }, 400);

  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") ?? "UB Freight";
  if (!apiKey) return json({ error: "BREVO_API_KEY not configured" }, 500);
  if (!senderEmail) return json({ error: "BREVO_SENDER_EMAIL not configured (must be a verified Brevo sender)" }, 500);

  const { data: reqRow, error: reqErr } = await db
    .from("rate_requests").select("id, subject, body, status").eq("id", requestId).maybeSingle();
  if (reqErr) return json({ error: reqErr.message }, 400);
  if (!reqRow) return json({ error: "request not found" }, 404);

  const { data: recData, error: recErr } = await db
    .from("rate_request_recipients").select("id, email, name").eq("request_id", requestId);
  if (recErr) return json({ error: recErr.message }, 400);
  const recipients = (recData ?? []) as Recipient[];
  if (recipients.length === 0) return json({ error: "no recipients on this request" }, 400);

  const subject = (reqRow.subject as string | null) ?? "Rate request";
  const textContent = (reqRow.body as string | null) ?? "";

  let sent = 0;
  const failed: { email: string; error: string }[] = [];

  for (const r of recipients) {
    try {
      const res = await apiFetch(BREVO, {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          to: [{ email: r.email, ...(r.name ? { name: r.name } : {}) }],
          subject,
          textContent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { failed.push({ email: r.email, error: (data?.message ?? `HTTP ${res.status}`) as string }); continue; }
      const messageId = (data?.messageId ?? null) as string | null;
      await db.from("rate_request_recipients").update({ email_message_id: messageId }).eq("id", r.id);
      sent++;
    } catch (e) {
      failed.push({ email: r.email, error: e instanceof Error ? e.message : "send failed" });
    }
  }

  if (sent > 0) {
    await db.from("rate_requests").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", requestId);
  }

  return json({ ok: sent > 0, sent, failed });
});
