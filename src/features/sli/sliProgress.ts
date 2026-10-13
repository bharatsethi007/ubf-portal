// src/features/sli/sliProgress.ts
// Section completeness for the SLI progress rail. Mirrors the useSli validation keys.
import type { SecState } from "./SliUI";
import { isYes } from "./SliUI";

export type SecKey = "shipper" | "cargo" | "customs" | "dg" | "security" | "docs" | "sign";
export const SECTIONS: { key: SecKey; title: string; short: string }[] = [
  { key: "shipper", title: "Shipper", short: "Shipper details" },
  { key: "cargo", title: "Cargo", short: "Pieces, weight, goods" },
  { key: "customs", title: "Payment & customs", short: "Payment, insurance, origin" },
  { key: "dg", title: "Dangerous goods", short: "DG and batteries" },
  { key: "security", title: "Security & notes", short: "Screening consent" },
  { key: "docs", title: "Documents", short: "Invoice, packing list" },
  { key: "sign", title: "Review & sign", short: "Declaration" },
];

const ERR_SECTION: Record<string, SecKey> = {
  is_paying: "customs", insurance_required: "customs", insurance_amount: "customs", country_of_origin: "customs",
  drawback_required: "customs", purpose_of_export: "customs", purpose_other: "customs",
  dangerous_goods: "dg", caa_screening_auth: "security", dg_cert_attachment: "docs",
  signed_name: "sign", signature: "sign", accepted: "sign",
};
export const sectionOfError = (e: string): SecKey | undefined => ERR_SECTION[e];

const yn = (v: any) => v === true || v === false || v === "yes" || v === "no";
const has = (v: any) => v != null && String(v).trim() !== "";

export function dgRequired(a: Record<string, any>) {
  return isYes(a.dangerous_goods) || (Array.isArray(a.batteries) ? a.batteries : []).some((b: string) => /lithium/i.test(b));
}

export function sectionStates(input: {
  val: (k: string) => any; a: Record<string, any>; attachments: any[]; errors: string[];
  signedName: string; signature: string; accepted: boolean;
}): Record<SecKey, SecState> {
  const { val, a, attachments, errors } = input;
  const done: Record<SecKey, boolean> = {
    shipper: has(val("supplier_name")) && has(val("supplier_address")),
    cargo: has(val("pieces")) && has(val("weight_kg")) && has(val("goods_description")),
    customs: yn(a.is_paying) && yn(a.insurance_required) && (!isYes(a.insurance_required) || Number(a.insurance_amount) > 0)
      && has(a.country_of_origin) && yn(a.drawback_required) && has(a.purpose_of_export)
      && (a.purpose_of_export !== "other" || has(a.purpose_other)),
    dg: yn(a.dangerous_goods),
    security: yn(a.caa_screening_auth),
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
