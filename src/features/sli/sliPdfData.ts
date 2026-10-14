// src/features/sli/sliPdfData.ts
// Turns what's on screen into the one-page PDF's fields.
import type { SliPdfData } from "./SliPdf";

const yn = (v: any) => (v === true || v === "yes" ? "Yes" : v === false || v === "no" ? "No" : "—");
const date = (v?: string | null, time = false) => {
  if (!v) return "";
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-NZ", time
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
};
const PURPOSE: Record<string, string> = { sold: "Sold", repair_return: "Repair & return", other: "Other" };
const BATT: Record<string, string> = { consumer: "Consumer", lithium_ion: "Lithium ion", lithium_metal: "Lithium metal", lead_acid: "Lead acid" };
const DOCS: Record<string, string> = {
  commercial_invoice: "Commercial invoice", packing_list: "Packing list", dg_cert: "DG declaration", cert_origin: "Certificate of origin",
  export_permit: "Export permit", letter_of_credit: "Letter of credit", other: "Other",
};

export function buildSliPdf(i: {
  staff: any; val: (k: string) => any; a: Record<string, any>; attachments: any[];
  signedName: string; signature: string; declaration: string;
}): SliPdfData {
  const { staff: s, val, a } = i;
  const kg = Number(val("weight_kg")) || 0;
  const cbm = Number(val("cbm")) || 0;
  const charge = Math.max(kg, cbm * 167);
  const cartage = a.collection_mode === "dropoff"
    ? ["Drop-off at UB Freight, Airport Oaks", a.cargo_ready_date ? `Date: ${date(a.cargo_ready_date)}` : ""]
    : a.collection_mode === "pickup"
      ? ["UB Freight to pick up", a.pickup_same === false ? a.pickup_address ?? "" : "From shipper address",
          [a.pickup_contact, a.pickup_phone].filter(Boolean).join(" · "), a.cargo_ready_date ? `Ready: ${date(a.cargo_ready_date)}` : ""]
      : ["Not stated"];
  const insured = a.insurance_required === "yes" || a.insurance_required === true;
  return {
    ref: s.booking_ref ?? "", customerRef: s.customer_ref ?? null,
    route: `${(s.origin || "AKL").toUpperCase()} - ${(s.destination || "").toUpperCase()}${s.transit_port ? ` via ${s.transit_port}` : ""}`,
    flight: [s.flight_no, date(s.flight_date)].filter(Boolean).join(" · "), cutoff: date(s.cutoff_at, true), incoterm: s.incoterm ?? "",
    shipper: [val("supplier_name"), val("supplier_address"), [val("supplier_city"), val("supplier_postcode"), val("supplier_country")].filter(Boolean).join(" "),
      [val("supplier_contact"), val("supplier_phone")].filter(Boolean).join(" · "), val("supplier_email")].filter(Boolean),
    consignee: [s.consignee_name, s.consignee_address, [s.consignee_city, s.consignee_country].filter(Boolean).join(", ")].filter(Boolean),
    pieces: val("pieces") ? String(val("pieces")) : "", weight: kg ? `${kg} kg` : "", cbm: cbm ? `${cbm} m³` : "",
    chargeable: charge ? `${charge.toLocaleString("en-NZ", { maximumFractionDigits: 1 })} kg` : "",
    goods: [val("goods_description"), val("po_number") ? `PO ${val("po_number")}` : ""].filter(Boolean).join("  ·  "),
    special: a.special_instructions ?? "",
    cartage,
    answers: [
      ["Paying the freight", yn(a.is_paying)],
      ["Insurance", insured ? `Yes, ${a.declared_currency || "NZD"} ${a.insurance_amount ?? ""}` : yn(a.insurance_required)],
      ["Declared value", a.declared_value ? `${a.declared_currency || "NZD"} ${a.declared_value}` : "—"],
      ["Country of origin", a.country_of_origin ?? "—"],
      ["Purpose of export", a.purpose_of_export === "other" ? `Other: ${a.purpose_other ?? ""}` : PURPOSE[a.purpose_of_export] ?? "—"],
      ["Dangerous goods", yn(a.dangerous_goods)],
      ["Consent to NZ CAA security screening", yn(a.caa_screening_auth)],
    ],
    batteries: (Array.isArray(a.batteries) && a.batteries.length ? a.batteries.map((b: string) => BATT[b] ?? b).join(", ") : "None"),
    documents: i.attachments.filter((x) => x.doc_type !== "sli_pdf").map((x) => `${DOCS[x.doc_type] ?? x.doc_type}: ${x.file_name}`),
    signedName: i.signedName, signature: i.signature, declaration: i.declaration,
    signedAt: new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }),
  };
}
