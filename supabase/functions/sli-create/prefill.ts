// supabase/functions/sli-create/prefill.ts
// Builds everything the SLI link shows already filled in: shipper, cargo, flight, consignee and suggested answers.
// deno-lint-ignore-file no-explicit-any
type Db = any;

const BUYER_PAYS = new Set(["EXW", "FCA", "FOB", "FAS"]);
const yn = (v: unknown) => (v === true ? "yes" : v === false ? "no" : undefined);
const join = (...p: unknown[]) => p.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean).join(", ");
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

export const BOOKING_COLS = [
  "id, booking_ref, module, origin, destination, incoterm, airline, airline_name, flight_no, etd, is_consolidation",
  "account_id, shipper_account_id, consignee_account_id, consol_id, customer_ref, cargo_ready_date",
  "shipper_name, shipper_address, shipper_city, shipper_country, shipper_phone, shipper_email, shipper_contact, shipper_postcode",
  "consignee_name, consignee_address, consignee_city, consignee_country, consignee_contact, notify_name",
  "pieces, gross_weight_kg, weight_kg, cbm, volume_m3, goods_description, commodity, packing_type, hs_code, pickup_address",
  "cargo_value, cargo_value_currency, needs_insurance, is_dg, un_number, dg_class, collection_mode",
].join(", ");

async function account(db: Db, id: string | null) {
  if (!id) return null;
  const { data } = await db.from("customers")
    .select("account_id, name, address1, address2, address3, city, postcode, country, phone, email, contact")
    .eq("account_id", id).maybeSingle();
  return data;
}

async function cargo(db: Db, bookingId: string) {
  const { data } = await db.from("booking_cargo_lines")
    .select("kind, ord, pieces, length, width, height, length_unit, cbm, weight, goods_desc")
    .eq("booking_id", bookingId).order("ord");
  const rows = (data ?? []) as any[];
  const act = rows.filter((r) => r.kind === "actual");
  const use = act.length ? act : rows.filter((r) => r.kind !== "actual");
  const sum = (k: string) => use.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return {
    measured: act.length > 0,
    lines: use.map((r) => ({ pieces: r.pieces, l: r.length, w: r.width, h: r.height, unit: r.length_unit ?? "cm", weight: r.weight, cbm: r.cbm })),
    pieces: use.length ? sum("pieces") : null,
    weight: use.length ? sum("weight") : null,
    cbm: use.length ? Math.round(sum("cbm") * 1000) / 1000 : null,
    desc: use.map((r) => r.goods_desc).find(Boolean) ?? null,
  };
}

async function consol(db: Db, id: string | null) {
  if (!id) return null;
  const { data } = await db.from("air_consols")
    .select("airline, flight_no, flight_date, cutoff_at, transit_port, flight2_no, flight2_date, eta_date")
    .eq("id", id).maybeSingle();
  return data;
}

/** Single-shipper prefill. Booking fields win over the TW account, measured cargo wins over booked. */
export async function singlePrefill(db: Db, bk: any) {
  const shipId = bk.shipper_account_id ?? bk.account_id ?? null;
  const [sh, cn, cg, cs] = await Promise.all([account(db, shipId), account(db, bk.consignee_account_id), cargo(db, bk.id), consol(db, bk.consol_id)]);

  const prefilled = {
    supplier_account_id: shipId,
    supplier_name: bk.shipper_name ?? sh?.name ?? null,
    supplier_address: bk.shipper_address ?? (join(sh?.address1, sh?.address2, sh?.address3) || null),
    supplier_city: bk.shipper_city ?? sh?.city ?? null,
    supplier_postcode: bk.shipper_postcode ?? sh?.postcode ?? null,
    supplier_country: bk.shipper_country ?? sh?.country ?? null,
    supplier_phone: bk.shipper_phone ?? sh?.phone ?? null,
    supplier_email: bk.shipper_email ?? sh?.email ?? null,
    supplier_contact: bk.shipper_contact ?? sh?.contact ?? null,
    pieces: cg.pieces ?? num(bk.pieces),
    weight_kg: cg.weight ?? num(bk.gross_weight_kg ?? bk.weight_kg),
    cbm: cg.cbm ?? num(bk.cbm ?? bk.volume_m3),
    po_number: bk.customer_ref ?? null,
    goods_description: bk.goods_description ?? bk.commodity ?? cg.desc ?? null,
    pickup_location: bk.pickup_address ?? null,
    packing_type: bk.packing_type ?? null,
    lines: cg.lines,
    measured: cg.measured,
  };

  const consignee = {
    consignee_name: bk.consignee_name ?? cn?.name ?? null,
    consignee_address: bk.consignee_address ?? (join(cn?.address1, cn?.address2, cn?.address3) || null),
    consignee_city: bk.consignee_city ?? cn?.city ?? null,
    consignee_country: bk.consignee_country ?? cn?.country ?? null,
  };

  const flight = {
    airline_name: cs?.airline ?? bk.airline_name ?? bk.airline ?? null,
    flight_no: cs?.flight_no ?? bk.flight_no ?? null,
    flight_date: cs?.flight_date ?? bk.etd ?? null,
    cutoff_at: cs?.cutoff_at ?? null,
    transit_port: cs?.transit_port ?? null,
    flight2_no: cs?.flight2_no ?? null,
    eta_date: cs?.eta_date ?? null,
  };

  // Suggested answers: the supplier still sees and can change every one of them.
  const inc = String(bk.incoterm ?? "").toUpperCase();
  const answers: Record<string, unknown> = {
    is_paying: inc ? (BUYER_PAYS.has(inc) ? "no" : "yes") : undefined,
    insurance_required: yn(bk.needs_insurance),
    insurance_amount: bk.needs_insurance && bk.cargo_value ? Number(bk.cargo_value) : undefined,
    declared_value: bk.cargo_value != null ? Number(bk.cargo_value) : undefined,
    declared_currency: bk.cargo_value_currency ?? "NZD",
    dangerous_goods: yn(bk.is_dg),
    purpose_of_export: "sold",
    collection_mode: bk.collection_mode === "dropoff" ? "dropoff" : bk.collection_mode ? "pickup" : undefined,
    cargo_ready_date: bk.cargo_ready_date ?? undefined,
    pickup_same: bk.pickup_address ? false : undefined,
    pickup_address: bk.pickup_address ?? undefined,
  };
  for (const k of Object.keys(answers)) if (answers[k] === undefined || answers[k] === null) delete answers[k];

  return { prefilled, consignee, flight, answers };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Branded invite email: logo, one summary card, one button. */
export function inviteHtml(o: { base: string; link: string; name: string; ref: string; route: string; flight: string; cargo: string }) {
  const row = (k: string, v: string) => v ? `<tr><td style="padding:4px 0;color:#64748b;width:90px">${k}</td><td style="padding:4px 0;color:#0f172a;font-weight:600">${esc(v)}</td></tr>` : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6fa;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e6eb;border-radius:12px;overflow:hidden">
    <div style="padding:18px 24px;border-bottom:1px solid #eef0f4"><img src="${o.base}/ub-freight-logo-ink.png" alt="UB Freight" height="34" style="display:block"></div>
    <div style="padding:22px 24px;font-size:14px;color:#334155;line-height:1.55">
      <p style="margin:0 0 12px">Dear ${esc(o.name)},</p>
      <p style="margin:0 0 16px">Your Shipper's Letter of Instruction is ready. We've filled in everything we know, so it should only take a couple of minutes to check, attach your invoice and sign.</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:8px;padding:10px 14px;display:block">
        ${row("Booking", o.ref)}${row("Route", o.route)}${row("Flight", o.flight)}${row("Cargo", o.cargo)}
      </table>
      <p style="margin:20px 0"><a href="${o.link}" style="background:#0A2472;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Review &amp; sign SLI</a></p>
      <p style="margin:0;color:#64748b;font-size:12px">The link expires in 14 days. If the button doesn't work, paste this into your browser:<br>${o.link}</p>
    </div>
    <div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11px">UB Freight Limited · 173 Montgomerie Road, Airport Oaks, Auckland 2022 · +64 9 966 3850</div>
  </div></div>`;
}

// ---- Saved templates (sli_profiles) ----
// Shipper and standing answers only. Cargo, value and DG change every shipment, so they never carry over.
export const TEMPLATE_PREFILL = ["supplier_name", "supplier_contact", "supplier_address", "supplier_city", "supplier_postcode",
  "supplier_country", "supplier_phone", "supplier_email"];
export const TEMPLATE_ANSWERS = ["is_paying", "insurance_required", "declared_currency", "country_of_origin", "purpose_of_export",
  "purpose_other", "caa_screening_auth", "collection_mode", "pickup_same", "pickup_address", "pickup_contact", "pickup_phone"];

export const profileKey = (acct: string | null, email: string | null) =>
  acct ? acct : email ? `email:${email.trim().toLowerCase()}` : null;

// Answers we only guess from the booking. The supplier's saved answer beats our guess; real booking data
// (cartage, ready date) beats the template.
const GUESSED = new Set(["is_paying", "insurance_required", "declared_currency", "country_of_origin", "purpose_of_export"]);

/** Booking data wins for shipper fields and cartage; the template wins over our guesses. */
export function applyTemplate(prefilled: Record<string, unknown>, answers: Record<string, unknown>, tpl: any) {
  const fromTemplate: string[] = [];
  const empty = (v: unknown) => v == null || v === "";
  for (const k of TEMPLATE_PREFILL) {
    const v = tpl?.prefilled?.[k];
    if (!empty(v) && empty(prefilled[k])) { prefilled[k] = v; fromTemplate.push(k); }
  }
  for (const k of TEMPLATE_ANSWERS) {
    const v = tpl?.answers?.[k];
    if (!empty(v) && (GUESSED.has(k) || empty(answers[k]))) { answers[k] = v; fromTemplate.push(k); }
  }
  return fromTemplate;
}
