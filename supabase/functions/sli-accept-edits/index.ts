// supabase/functions/sli-accept-edits/index.ts
// STAFF (verify_jwt = true). Applies a customer's proposed edits from an endorsed SLI
// into the booking / booking_suppliers row. This is the ops acceptance gate.
// Body: { sli_id: uuid, fields?: string[] }  // fields optional = accept all
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// which edit keys map onto booking_suppliers columns
const SUPPLIER_COLS = new Set([
  "supplier_name", "supplier_address", "supplier_city", "supplier_phone", "supplier_email",
  "po_number", "goods_description", "pieces",
]);
// weight/cbm edits map to the gross_/cbm columns
const COL_ALIAS: Record<string, string> = { weight_kg: "gross_weight_kg", cbm: "cbm" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);

    const { sli_id, fields } = await req.json();
    if (!sli_id) return json({ error: "sli_id required" }, 400);

    const db = createClient(url, service);
    const { data: sli } = await db.from("sli_documents")
      .select("id, status, booking_id, booking_supplier_id, customer_edits, edits_accepted_at")
      .eq("id", sli_id).maybeSingle();
    if (!sli) return json({ error: "not found" }, 404);
    if (sli.status !== "endorsed") return json({ error: "not_endorsed" }, 409);

    const edits = (sli.customer_edits ?? {}) as Record<string, unknown>;
    const keys = Array.isArray(fields) && fields.length ? fields : Object.keys(edits);
    if (!keys.length) return json({ error: "no_edits" }, 400);

    const supplierPatch: Record<string, unknown> = {};
    for (const k of keys) {
      if (!(k in edits)) continue;
      if (SUPPLIER_COLS.has(k)) supplierPatch[k] = edits[k];
      else if (k in COL_ALIAS) supplierPatch[COL_ALIAS[k]] = edits[k];
    }

    // apply to the supplier row (consolidation) — single-shipper edits to booking_suppliers
    // only exist when booking_supplier_id is set; single-shipper party edits are advisory.
    if (sli.booking_supplier_id && Object.keys(supplierPatch).length) {
      const { error: upErr } = await db.from("booking_suppliers")
        .update(supplierPatch).eq("id", sli.booking_supplier_id);
      if (upErr) return json({ error: upErr.message }, 400);
    }

    await db.from("sli_documents").update({
      edits_accepted_at: new Date().toISOString(), edits_accepted_by: ures.user.id,
    }).eq("id", sli_id);

    await db.from("sli_events").insert({
      sli_id, event: "edits_accepted", actor: ures.user.id,
      detail: { applied: Object.keys(supplierPatch), requested: keys },
    });

    return json({ status: "accepted", applied: Object.keys(supplierPatch) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
