// supabase/functions/sli-finish/index.ts
// PUBLIC (verify_jwt = false). Auth = token in body, SLI must already be endorsed.
// Body: { token, save_template: bool, email_pdf: bool, pdf_email?: string, pdf_base64?: string }
// Saves the supplier's choices to sli_profiles, stores the template, and emails them the one-page PDF.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
import { putObject } from "../_shared/s3.ts";
setApiFn("sli-finish");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PREFILL_KEYS = ["supplier_name", "supplier_contact", "supplier_address", "supplier_city", "supplier_postcode",
  "supplier_country", "supplier_phone", "supplier_email"];
const ANSWER_KEYS = ["is_paying", "insurance_required", "declared_currency", "country_of_origin", "purpose_of_export",
  "purpose_other", "caa_screening_auth", "collection_mode", "pickup_same", "pickup_address", "pickup_contact", "pickup_phone"];
const pick = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => o[k] != null && o[k] !== "").map((k) => [k, o[k]]));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const b = await req.json();
    const token = String(b.token ?? "");
    if (!token) return json({ error: "token required" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: sli } = await db.from("sli_documents")
      .select("id, status, staff_fields, prefilled, customer_edits, sli_answers, signed_name, supplier_account_id, pdf_path")
      .eq("token", token).maybeSingle();
    if (!sli) return json({ error: "invalid_link" }, 404);
    if (sli.status !== "endorsed") return json({ error: "not_endorsed" }, 409);

    const shipper = { ...(sli.prefilled ?? {}), ...(sli.customer_edits ?? {}) } as Record<string, unknown>;
    const answers = (sli.sli_answers ?? {}) as Record<string, unknown>;
    const supplierEmail = (shipper.supplier_email as string | undefined)?.trim() || null;
    const key = sli.supplier_account_id ?? (supplierEmail ? `email:${supplierEmail.toLowerCase()}` : null);

    const saveTemplate = !!b.save_template;
    const emailPdf = !!b.email_pdf;
    const pdfEmail = String(b.pdf_email ?? supplierEmail ?? "").trim();
    if (emailPdf && !EMAIL.test(pdfEmail)) return json({ error: "valid email required" }, 400);

    // PDF copy lives with the SLI so staff see the same document.
    const hasPdf = typeof b.pdf_base64 === "string" && b.pdf_base64.length > 100 && b.pdf_base64.length < 8_000_000;
    let pdfPath: string | null = null;
    // One stored copy per SLI; repeat calls can still email but don't write again.
    if (hasPdf && !sli.pdf_path) {
      pdfPath = `${token}/SLI_${Date.now()}.pdf`;
      const bytes = Uint8Array.from(atob(b.pdf_base64), (c) => c.charCodeAt(0));
      try { await putObject(`sli-uploads/${pdfPath}`, bytes, "application/pdf"); } catch { pdfPath = null; }
    }
    if (pdfPath) {
      await db.from("sli_documents").update({ pdf_path: pdfPath }).eq("id", sli.id);
      const { data: have } = await db.from("sli_attachments").select("id").eq("sli_id", sli.id).eq("storage_path", pdfPath).maybeSingle();
      if (!have) await db.from("sli_attachments").insert({ sli_id: sli.id, doc_type: "sli_pdf", file_name: `SLI ${sli.staff_fields?.booking_ref ?? ""}.pdf`.trim(), storage_path: pdfPath });
    }

    if (key) {
      const row: Record<string, unknown> = {
        key, account_id: sli.supplier_account_id ?? null, email: supplierEmail,
        save_template: saveTemplate, email_pdf: emailPdf, pdf_email: emailPdf ? pdfEmail : null,
        last_sli_id: sli.id, updated_at: new Date().toISOString(),
      };
      if (saveTemplate) {
        row.template = { prefilled: pick(shipper, PREFILL_KEYS), answers: pick(answers, ANSWER_KEYS), signed_name: sli.signed_name ?? null };
        row.template_saved_at = new Date().toISOString();
      }
      const { error } = await db.from("sli_profiles").upsert(row, { onConflict: "key" });
      if (error) return json({ error: error.message }, 400);
    }

    let emailed = false;
    if (emailPdf && hasPdf) {
      const apiKey = Deno.env.get("BREVO_API_KEY");
      const from = Deno.env.get("SLI_FROM_EMAIL") ?? "no-reply@ubfreight.com";
      const ref = sli.staff_fields?.booking_ref ?? "";
      if (apiKey) {
        const r = await apiFetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: from, name: "UB Freight" },
            replyTo: { email: "exportair.nz@ubfreight.com", name: "UB Freight Export Air" },
            to: [{ email: pdfEmail }],
            subject: `Your signed SLI – ${ref}`,
            htmlContent: `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#334155;line-height:1.55">
              <p>Hi${sli.signed_name ? ` ${String(sli.signed_name).split(" ")[0]}` : ""},</p>
              <p>Thanks for signing the Shipper's Letter of Instruction for <b>${ref}</b>. A copy is attached for your records.</p>
              <p>Questions? Reply to this email or call +64 9 966 3850.</p><p>Kind regards,<br>UB Freight Export Air</p></div>`,
            attachment: [{ name: `SLI ${ref}.pdf`, content: b.pdf_base64 }],
          }),
        });
        emailed = r.ok;
      }
    }

    await db.from("sli_events").insert({
      sli_id: sli.id, event: "finished",
      detail: { save_template: saveTemplate, email_pdf: emailPdf, pdf_email: emailPdf ? pdfEmail : null, emailed },
    });
    return json({ ok: true, emailed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
