// Emails the team inbox (and booking handler) when a customer uploads a document in the portal.
// Called by the booking_documents trigger (service role). POST { document_id, dry?: true }.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderNotify } from "../portal-booking-notify/notifyEmail.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("portal-doc-notify");

const CONSOLE_URL = "https://console.ubfreight.com";
const INBOX: Record<string, { email: string; team: string }> = {
  IS: { email: "importsea.nz@ubfreight.com", team: "Import Sea" },
  ES: { email: "exportsea.nz@ubfreight.com", team: "Export Sea" },
  IA: { email: "importair.nz@ubfreight.com", team: "Import Air" },
  EA: { email: "exportair.nz@ubfreight.com", team: "Export Air" },
};
const FALLBACK = { email: "info.nz@ubfreight.com", team: "UB Freight" };

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const title = (s?: string | null) =>
  s ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Ltd|Nz)\b/g, (m) => m.toUpperCase()) : null;
const size = (b?: number | null) =>
  !b ? null : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;

Deno.serve(async (req) => {
  try {
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (req.headers.get("Authorization") !== `Bearer ${service}`) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.document_id === "string" ? body.document_id : "";
    if (!id) return json({ error: "document_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, service);
    const { data: d, error } = await admin.rpc("portal_doc_notify_payload", { p_doc: id });
    if (error) throw error;
    if (!d) return json({ skipped: "not a customer upload" });

    const box = INBOX[d.module ?? ""] ?? FALLBACK;
    const who = title(d.customer) ?? d.account_id ?? "Customer";
    const ref = d.booking_ref ? `booking ${d.booking_ref}` : null;
    const subject = `Portal document from ${who}${ref ? ` on ${ref}` : ""}: ${d.file_name}`;
    const email = {
      preheader: `${who} uploaded ${d.file_name}`,
      eyebrow: `${box.team} · Portal document`,
      title: `${who} uploaded a document`,
      intro: [`A new file was added from the customer portal. It is on the booking's Documents tab.`],
      callout: null,
      facts: [
        ["File", d.file_name], ["Size", size(d.size_bytes)], ["Customer", `${who} (${d.account_id ?? "—"})`],
        ["Uploaded by", d.uploader_email], ["Booking", d.booking_ref],
      ] as [string, string | null][],
      button: { label: "Open booking", url: `${CONSOLE_URL}/bookings/${d.booking_id}?tab=documents` },
      footer: "Customer uploads are always visible to the customer and to UB Freight staff.",
    };
    const to = [{ email: Deno.env.get("PORTAL_BOOKING_ALERT_TO") || box.email }];
    const cc = d.handler_email && d.handler_email !== to[0].email ? [{ email: d.handler_email }] : undefined;
    if (body?.dry) return json({ dry: true, to, cc, subject, text: renderNotify(email).text });

    const key = Deno.env.get("BREVO_API_KEY");
    if (!key) return json({ error: "BREVO_API_KEY not set" }, 500);
    const { html, text } = renderNotify(email);
    const r = await apiFetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com", name: "UBF Portal" },
        to, ...(cc ? { cc } : {}), subject, htmlContent: html, textContent: text,
      }),
    });
    if (!r.ok) console.error("brevo", r.status, await r.text());
    return json({ sent: r.ok, to: to[0].email });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
