// supabase/functions/sli-submit/index.ts
// PUBLIC (verify_jwt = false). Auth = token in body. Customer endorses their SLI.
// Body: {
//   token: string,
//   customer_edits: object,     // proposed changes to prefilled fields (NOT written to booking)
//   sli_answers: object,        // required SLI answers (see validation below)
//   signed_name: string,
//   signature: string,          // typed name or base64 drawn
//   attachments?: [{ doc_type, file_name, storage_path }]  // already uploaded to sli-uploads
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

// module -> ops mailbox (mirrors get_booking_meta)
const opsMailbox = (m: string): string => {
  const map: Record<string, string> = {
    EA: "exportair.nz@ubfreight.com", FEA: "exportair.nz@ubfreight.com",
    ES: "exportsea.nz@ubfreight.com", FES: "exportsea.nz@ubfreight.com",
    IA: "importair.nz@ubfreight.com", FIA: "importair.nz@ubfreight.com",
    IS: "importsea.nz@ubfreight.com", FIS: "importsea.nz@ubfreight.com",
  };
  return map[m] ?? "info.nz@ubfreight.com";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { token, customer_edits = {}, sli_answers = {}, signed_name, signature, attachments = [] } = body;
    if (!token) return json({ error: "token required" }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sli } = await db.from("sli_documents")
      .select("id, status, expires_at, booking_id, staff_fields, supplier_account_id")
      .eq("token", token).maybeSingle();
    if (!sli) return json({ error: "invalid_link" }, 404);
    if (sli.status === "endorsed") return json({ error: "already_endorsed" }, 409);
    if (sli.status === "expired" || new Date(sli.expires_at) < new Date())
      return json({ error: "expired" }, 410);

    // ── required-field validation ──────────────────────────────────
    const a = sli_answers as Record<string, unknown>;
    const errs: string[] = [];
    const yn = (v: unknown) => v === true || v === false || v === "yes" || v === "no";
    const isYes = (v: unknown) => v === true || v === "yes";

    if (!signed_name?.trim()) errs.push("signed_name");
    if (!signature?.trim()) errs.push("signature");
    if (!yn(a.is_paying)) errs.push("is_paying");                          // "are you paying for this shipment?"
    if (!yn(a.insurance_required)) errs.push("insurance_required");
    if (isYes(a.insurance_required) && !(Number(a.insurance_amount) > 0)) errs.push("insurance_amount");
    if (!yn(a.dangerous_goods)) errs.push("dangerous_goods");
    if (!a.country_of_origin) errs.push("country_of_origin");
    if (!yn(a.drawback_required)) errs.push("drawback_required");
    if (!a.purpose_of_export) errs.push("purpose_of_export");
    if (a.purpose_of_export === "other" && !(a.purpose_other as string)?.trim()) errs.push("purpose_other");
    if (!yn(a.caa_screening_auth)) errs.push("caa_screening_auth");

    // DG / lithium battery -> DG cert attachment required
    const batteries = Array.isArray(a.batteries) ? (a.batteries as string[]) : [];
    const hasLithium = batteries.some((b) => /lithium/i.test(b));
    const dgRequired = isYes(a.dangerous_goods) || hasLithium;
    const hasDgCert = (attachments as Array<{ doc_type: string }>).some((x) => x.doc_type === "dg_cert");
    if (dgRequired && !hasDgCert) errs.push("dg_cert_attachment");

    if (errs.length) return json({ error: "validation", fields: errs }, 422);

    // ── write endorsement (edits stay as proposals; ops accepts later) ──
    const nowIso = new Date().toISOString();
    const { error: upErr } = await db.from("sli_documents").update({
      status: "endorsed",
      customer_edits, sli_answers,
      signed_name, signature, signed_at: nowIso, endorsed_at: nowIso,
    }).eq("id", sli.id);
    if (upErr) return json({ error: upErr.message }, 400);

    if (Array.isArray(attachments) && attachments.length) {
      await db.from("sli_attachments").insert(
        attachments.map((x: Record<string, unknown>) => ({
          sli_id: sli.id, doc_type: x.doc_type, file_name: x.file_name, storage_path: x.storage_path,
        })),
      );
    }

    // ── notify ops via Brevo (non-blocking: failure doesn't fail the endorsement) ──
    try {
      const key = Deno.env.get("BREVO_API_KEY");
      const from = Deno.env.get("SLI_FROM_EMAIL") ?? "no-reply@ubfreight.com";
      const sf = (sli.staff_fields ?? {}) as Record<string, string>;
      const to = opsMailbox(sf.module ?? "");
      const ref = sf.booking_ref ?? sli.booking_id;
      if (key) {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: from, name: "UB Freight Portal" },
            to: [{ email: to }],
            subject: `SLI endorsed – ${ref} – ${sf.origin ?? ""} to ${sf.destination ?? ""}`,
            htmlContent:
              `<p>An SLI has been endorsed by the customer.</p>
               <p><b>Booking:</b> ${ref}<br>
               <b>Lane:</b> ${sf.origin ?? "-"} → ${sf.destination ?? "-"}<br>
               <b>Signed by:</b> ${signed_name} at ${nowIso}<br>
               <b>Proposed edits:</b> ${Object.keys(customer_edits).length ? "yes — review in portal" : "none"}<br>
               <b>Attachments:</b> ${(attachments as unknown[]).length}</p>
               <p>Open the booking in the portal to review and accept changes.</p>`,
          }),
        });
      }
    } catch (_) { /* email best-effort */ }

    return json({ status: "endorsed", endorsed_at: nowIso });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
