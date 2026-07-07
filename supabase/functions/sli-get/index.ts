// supabase/functions/sli-get/index.ts
// PUBLIC (verify_jwt = false). Auth is the token in the body — NOT a JWT.
// Body: { token: string }
// Returns everything the customer page renders; marks the SLI 'viewed'.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "token required" }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sli } = await db.from("sli_documents")
      .select("id, status, staff_fields, prefilled, customer_edits, sli_answers, signed_name, signed_at, expires_at, booking_id, supplier_account_id")
      .eq("token", token).maybeSingle();
    if (!sli) return json({ error: "invalid_link" }, 404);

    // expiry
    if (sli.status === "expired" || new Date(sli.expires_at) < new Date()) {
      if (sli.status !== "expired") await db.from("sli_documents").update({ status: "expired" }).eq("id", sli.id);
      return json({ status: "expired" });
    }

    // already endorsed -> read-only receipt
    if (sli.status === "endorsed") {
      const { data: atts } = await db.from("sli_attachments")
        .select("doc_type, file_name, uploaded_at").eq("sli_id", sli.id);
      return json({ status: "endorsed", readOnly: true, sli, attachments: atts ?? [] });
    }

    // first open -> mark viewed
    if (sli.status === "sent") {
      await db.from("sli_documents").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", sli.id);
      sli.status = "viewed";
    }

    const { data: countries } = await db.from("countries").select("code, name").order("name");
    const { data: atts } = await db.from("sli_attachments")
      .select("id, doc_type, file_name, uploaded_at").eq("sli_id", sli.id);

    return json({
      status: sli.status,
      readOnly: false,
      sli,                       // staff_fields (read-only), prefilled (editable), customer_edits, sli_answers
      attachments: atts ?? [],
      countries: countries ?? [],
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
