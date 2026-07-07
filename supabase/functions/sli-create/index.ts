// supabase/functions/sli-create/index.ts
// STAFF (verify_jwt = true). Creates/regenerates an SLI for a supplier on a booking.
// Body: { booking_id: uuid, booking_supplier_id?: uuid|null }
// - consolidation: pass booking_supplier_id (one SLI per supplier)
// - single shipper: omit booking_supplier_id (supplier = booking.account_id)
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // verify caller is a staff user (RLS-scoped client using their JWT)
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);

    const { booking_id, booking_supplier_id = null } = await req.json();
    if (!booking_id) return json({ error: "booking_id required" }, 400);

    const db = createClient(url, service); // service role for the writes/snapshot

    // load booking header (staff read-only fields)
    const { data: bk, error: bkErr } = await db.from("bookings")
      .select("id, booking_ref, module, origin, destination, incoterm, airline_name, flight_no, is_consolidation, account_id, consignee_account_id")
      .eq("id", booking_id).single();
    if (bkErr || !bk) return json({ error: "booking not found" }, 404);

    // resolve supplier source row + account id
    let supplierAcct: string | null = null;
    let supplierSnap: Record<string, unknown> = {};
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
      supplierAcct = bk.account_id ?? null;
      const { data: cust } = await db.from("customers").select("name, account_id").eq("account_id", supplierAcct).maybeSingle();
      supplierSnap = { supplier_name: cust?.name ?? null, supplier_account_id: supplierAcct };
    }

    // recipient email (prime contact -> any contact -> customer email; skip internal)
    let recipient: string | null = (supplierSnap.supplier_email as string) ?? null;
    if (!recipient && supplierAcct) {
      const { data: c } = await db.from("contacts")
        .select("email, is_prime").eq("account_id", supplierAcct)
        .not("email", "is", null).order("is_prime", { ascending: false });
      recipient = c?.find((r) => r.email && !/@ubfreight\.com/i.test(r.email))?.email ?? null;
    }

    // country-of-origin auto-suggest: supplier_country -> origin port country
    let originCountry: string | null = (supplierSnap.supplier_country as string) ?? null;
    if (!originCountry && bk.origin) {
      const { data: port } = await db.from("ports").select("country_code").eq("code", bk.origin).maybeSingle();
      originCountry = port?.country_code ?? null;
    }

    // expire any existing active SLI for this supplier-per-booking
    const expireMatch = db.from("sli_documents").update({ status: "expired" })
      .eq("booking_id", booking_id).neq("status", "expired");
    await (booking_supplier_id
      ? expireMatch.eq("booking_supplier_id", booking_supplier_id)
      : expireMatch.is("booking_supplier_id", null));

    const staff_fields = {
      booking_ref: bk.booking_ref, module: bk.module,
      origin: bk.origin, destination: bk.destination, incoterm: bk.incoterm,
      airline_name: bk.airline_name, flight_no: bk.flight_no,
      is_consolidation: bk.is_consolidation, consignee_account_id: bk.consignee_account_id,
    };
    const sli_answers = { country_of_origin: originCountry }; // pre-suggested, customer can change

    const { data: created, error: insErr } = await db.from("sli_documents").insert({
      booking_id, booking_supplier_id, supplier_account_id: supplierAcct,
      status: "sent", staff_fields, prefilled: supplierSnap, sli_answers,
      created_by: ures.user.id, sent_at: new Date().toISOString(),
    }).select("token").single();
    if (insErr) return json({ error: insErr.message }, 400);

    const base = Deno.env.get("SLI_PUBLIC_BASE_URL") ?? "";
    const link = base ? `${base}/sli/${created.token}` : `/sli/${created.token}`;

    // ── outbound email to customer via Brevo (canonical SLI subject) ──
    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    if (recipient && base) { // need an absolute link to email
      try {
        const key = Deno.env.get("BREVO_API_KEY");
        const from = Deno.env.get("SLI_FROM_EMAIL") ?? "no-reply@ubfreight.com";
        if (key) {
          const r = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sender: { email: from, name: "UB Freight" },
              to: [{ email: recipient, name: (supplierSnap.supplier_name as string) ?? undefined }],
              subject: `SLI for endorsement – ${bk.booking_ref} – ${bk.origin} to ${bk.destination}`,
              htmlContent:
                `<p>Dear ${(supplierSnap.supplier_name as string) ?? "Customer"},</p>
                 <p>Please review and endorse the Shipper's Letter of Instruction for the shipment below.</p>
                 <p><b>Booking:</b> ${bk.booking_ref}<br>
                 <b>Route:</b> ${bk.origin} &rarr; ${bk.destination}</p>
                 <p><a href="${link}" style="background:#0A2472;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Open &amp; endorse SLI</a></p>
                 <p style="color:#64748b;font-size:12px">This link expires in 14 days. If the button doesn't work, paste this into your browser:<br>${link}</p>
                 <p>Kind regards,<br>UB Freight</p>`,
            }),
          });
          emailStatus = r.ok ? "sent" : "failed";
        }
      } catch { emailStatus = "failed"; }
    }

    // log email outcome
    await db.from("sli_events").insert({
      sli_id: (await db.from("sli_documents").select("id").eq("token", created.token).single()).data?.id,
      event: emailStatus === "sent" ? "email_sent" : emailStatus === "failed" ? "email_failed" : "created",
      actor: ures.user.id,
      detail: { recipient, email_status: emailStatus },
    });

    return json({ token: created.token, link, recipient, email_status: emailStatus });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
