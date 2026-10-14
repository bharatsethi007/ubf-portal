// supabase/functions/sli-create/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
import { BOOKING_COLS, applyTemplate, inviteHtml, profileKey, singlePrefill } from "./prefill.ts";
setApiFn("sli-create");

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);

    const { booking_id, booking_supplier_id = null, send = true } = await req.json();
    if (!booking_id) return json({ error: "booking_id required" }, 400);

    const db = createClient(url, service);

    const { data: bk, error: bkErr } = await db.from("bookings")
      .select(BOOKING_COLS)
      .eq("id", booking_id).single();
    if (bkErr || !bk) return json({ error: "booking not found" }, 404);

    let supplierAcct: string | null = null;
    let supplierSnap: Record<string, unknown> = {};
    let single: Awaited<ReturnType<typeof singlePrefill>> | null = null;
    if (booking_supplier_id) {
      const { data: sup } = await db.from("booking_suppliers")
        .select("*").eq("id", booking_supplier_id).eq("booking_id", booking_id).single();
      if (!sup) return json({ error: "supplier not found on booking" }, 404);
      supplierAcct = sup.supplier_account_id ?? null;
      supplierSnap = {
        supplier_name: sup.supplier_name, supplier_address: sup.supplier_address,
        supplier_city: sup.supplier_city, supplier_country: sup.supplier_country,
        supplier_phone: sup.supplier_phone, supplier_email: sup.supplier_email,
        po_number: sup.po_number, commodity: sup.commodity, goods_description: sup.goods_description,
        pieces: sup.pieces, weight_kg: sup.gross_weight_kg ?? sup.weight_kg, cbm: sup.cbm ?? sup.volume_m3,
        pickup_location: sup.pickup_location,
      };
    } else {
      single = await singlePrefill(db, bk);
      supplierAcct = (single.prefilled.supplier_account_id as string) ?? null;
      supplierSnap = single.prefilled;
    }

    let recipient: string | null = (supplierSnap.supplier_email as string) ?? null;
    if (!recipient && supplierAcct) {
      const { data: c } = await db.from("contacts")
        .select("email, is_prime").eq("account_id", supplierAcct)
        .not("email", "is", null).order("is_prime", { ascending: false });
      recipient = c?.find((r) => r.email && !/@ubfreight\.com/i.test(r.email))?.email ?? null;
    }

    let originCountry: string | null = (supplierSnap.supplier_country as string) ?? null;
    if (!originCountry && bk.origin) {
      const { data: port } = await db.from("ports").select("country_code").eq("code", bk.origin).maybeSingle();
      originCountry = port?.country_code ?? null;
    }

    const expireMatch = db.from("sli_documents").update({ status: "expired" })
      .eq("booking_id", booking_id).neq("status", "expired");
    await (booking_supplier_id
      ? expireMatch.eq("booking_supplier_id", booking_supplier_id)
      : expireMatch.is("booking_supplier_id", null));

    const answers: Record<string, unknown> = { ...(single?.answers ?? {}), country_of_origin: originCountry };

    // Saved template + preferences from the supplier's last SLI.
    const pkey = profileKey(supplierAcct, (supplierSnap.supplier_email as string) ?? null);
    const { data: prof } = pkey
      ? await db.from("sli_profiles").select("save_template, email_pdf, pdf_email, template").eq("key", pkey).maybeSingle()
      : { data: null };
    const fromTemplate = prof?.save_template && prof.template ? applyTemplate(supplierSnap, answers, prof.template) : [];
    const staff_fields = {
      booking_ref: bk.booking_ref, module: bk.module,
      origin: bk.origin, destination: bk.destination, incoterm: bk.incoterm,
      airline_name: bk.airline_name, flight_no: bk.flight_no,
      is_consolidation: bk.is_consolidation, consignee_account_id: bk.consignee_account_id,
      customer_ref: bk.customer_ref, cargo_ready_date: bk.cargo_ready_date, hs_code: bk.hs_code,
      is_dg: bk.is_dg, un_number: bk.un_number, dg_class: bk.dg_class,
      ...(single?.consignee ?? {}),
      ...Object.fromEntries(Object.entries(single?.flight ?? {}).filter(([, v]) => v != null)),
      // Answers UB Freight filled in for the supplier; the page marks them "suggested" until touched.
      suggested: Object.keys(answers).filter((k) => answers[k] != null && !fromTemplate.includes(k)),
      from_template: fromTemplate,
      template_signed_name: prof?.save_template ? prof?.template?.signed_name ?? null : null,
      prefs: prof ? { save_template: prof.save_template, email_pdf: prof.email_pdf, pdf_email: prof.pdf_email } : null,
    };
    const sli_answers = answers;

    const { data: created, error: insErr } = await db.from("sli_documents").insert({
      booking_id, booking_supplier_id, supplier_account_id: supplierAcct,
      status: "sent", staff_fields, prefilled: supplierSnap, sli_answers,
      created_by: ures.user.id, sent_at: new Date().toISOString(),
    }).select("token").single();
    if (insErr) return json({ error: insErr.message }, 400);

    const base = Deno.env.get("SLI_PUBLIC_BASE_URL") ?? "";
    const link = base ? `${base}/sli/${created.token}` : `/sli/${created.token}`;

    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    if (send && recipient && base) {
      try {
        const key = Deno.env.get("BREVO_API_KEY");
        const from = Deno.env.get("SLI_FROM_EMAIL") ?? "no-reply@ubfreight.com";
        if (key) {
          const r = await apiFetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sender: { email: from, name: "UB Freight" },
              to: [{ email: recipient, name: (supplierSnap.supplier_name as string) ?? undefined }],
              subject: `SLI for endorsement – ${bk.booking_ref} – ${bk.origin} to ${bk.destination}`,
              htmlContent: inviteHtml({
                base, link, name: (supplierSnap.supplier_name as string) ?? "Customer", ref: bk.booking_ref,
                route: `${bk.origin ?? "AKL"} → ${bk.destination ?? ""}`,
                flight: [staff_fields.flight_no, staff_fields.flight_date].filter(Boolean).join(" · "),
                cargo: [supplierSnap.pieces && `${supplierSnap.pieces} pcs`, supplierSnap.weight_kg && `${supplierSnap.weight_kg} kg`].filter(Boolean).join(" · "),
              }),
            }),
          });
          emailStatus = r.ok ? "sent" : "failed";
        }
      } catch { emailStatus = "failed"; }
    }

    const { data: sliRow } = await db.from("sli_documents").select("id").eq("token", created.token).single();
    await db.from("sli_events").insert({
      sli_id: sliRow?.id,
      event: emailStatus === "sent" ? "email_sent" : emailStatus === "failed" ? "email_failed" : "created",
      actor: ures.user.id,
      detail: { recipient, email_status: emailStatus },
    });

    return json({
      token: created.token, link, recipient, email_status: emailStatus, name: supplierSnap.supplier_name ?? null,
      summary: { ref: bk.booking_ref, route: `${bk.origin ?? "AKL"} → ${bk.destination ?? ""}`,
        flight: [staff_fields.flight_no, staff_fields.flight_date].filter(Boolean).join(" · "),
        cargo: [supplierSnap.pieces && `${supplierSnap.pieces} pcs`, supplierSnap.weight_kg && `${supplierSnap.weight_kg} kg`].filter(Boolean).join(" · ") },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
