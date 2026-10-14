// src/features/sli/sliProgress.ts
// Section completeness for the SLI progress rail. Mirrors the useSli validation keys.
import type { SecState } from "./SliUI";
import { isYes } from "./SliUI";

export type SecKey = "shipper" | "cargo" | "cartage" | "customs" | "dg" | "docs" | "sign";
export const SECTIONS: { key: SecKey; title: string; short: string }[] = [
  { key: "shipper", title: "Shipper", short: "Who is sending" },
  { key: "cargo", title: "Cargo", short: "Pieces, weight, goods" },
  { key: "cartage", title: "Pickup or drop-off", short: "How it gets to us" },
  { key: "customs", title: "Payment & customs", short: "Payment, insurance, origin" },
  { key: "dg", title: "Safety & security", short: "DG, batteries, screening" },
  { key: "docs", title: "Documents", short: "Invoice, packing list" },
  { key: "sign", title: "Review & sign", short: "Declaration" },
];

const ERR_SECTION: Record<string, SecKey> = {
  collection_mode: "cartage", cargo_ready_date: "cartage", pickup_address: "cartage",
  is_paying: "customs", insurance_required: "customs", insurance_amount: "customs", country_of_origin: "customs",
  purpose_of_export: "customs", purpose_other: "customs",
  dangerous_goods: "dg", caa_screening_auth: "dg", dg_cert_attachment: "docs",
  signed_name: "sign", signature: "sign", accepted: "sign",
};
export const sectionOfError = (e: string): SecKey | undefined => ERR_SECTION[e];

const yn = (v: any) => v === true || v === false || v === "yes" || v === "no";
const has = (v: any) => v != null && String(v).trim() !== "";

export function dgRequired(a: Record<string, any>) {
  return isYes(a.dangerous_goods) || (Array.isArray(a.batteries) ? a.batteries : []).some((b: string) => /lithium/i.test(b));
}

export function cartageDone(a: Record<string, any>) {
  if (a.collection_mode !== "pickup" && a.collection_mode !== "dropoff") return false;
  if (!has(a.cargo_ready_date)) return false;
  return a.collection_mode === "dropoff" || a.pickup_same !== false || has(a.pickup_address);
}

export function sectionStates(input: {
  val: (k: string) => any; a: Record<string, any>; attachments: any[]; errors: string[];
  signedName: string; signature: string; accepted: boolean;
}): Record<SecKey, SecState> {
  const { val, a, attachments, errors } = input;
  const done: Record<SecKey, boolean> = {
    shipper: has(val("supplier_name")) && has(val("supplier_address")),
    cargo: has(val("pieces")) && has(val("weight_kg")) && has(val("goods_description")),
    cartage: cartageDone(a),
    customs: yn(a.is_paying) && yn(a.insurance_required) && (!isYes(a.insurance_required) || Number(a.insurance_amount) > 0)
      && has(a.country_of_origin) && has(a.purpose_of_export) && (a.purpose_of_export !== "other" || has(a.purpose_other)),
    dg: yn(a.dangerous_goods) && yn(a.caa_screening_auth),
    docs: !dgRequired(a) || attachments.some((x) => x.doc_type === "dg_cert"),
    sign: has(input.signedName) && has(input.signature) && input.accepted,
  };
  const bad = new Set(errors.map(sectionOfError).filter(Boolean) as SecKey[]);
  const out = {} as Record<SecKey, SecState>;
  for (const s of SECTIONS) {
    out[s.key] = done[s.key]
      ? (s.key === "docs" && !attachments.length ? "optional" : "done")
      : bad.has(s.key) ? "error" : "todo";
  }
  return out;
}
