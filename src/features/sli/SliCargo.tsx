// src/features/sli/SliCargo.tsx
// Sections 1–2: shipper and cargo. Editable, prefilled from the booking, live chargeable weight.
import React from "react";
import { Field, Label, Section, inputCls, type SecState } from "./SliUI";

const VOL_FACTOR = 167; // 1 m³ = 167 kg (air)
const n1 = (v: number) => (v ? v.toLocaleString("en-NZ", { maximumFractionDigits: 1 }) : "0");

type Props = {
  prefilled: any; edits: Record<string, any>; setEdit: (k: string, v: any) => void;
  states: { shipper: SecState; cargo: SecState };
};

export default function SliCargo({ prefilled, edits, setEdit, states }: Props) {
  const p = prefilled ?? {};
  const val = (k: string) => (k in edits ? edits[k] : p[k]);
  const tag = (k: string) => (!(k in edits) && p[k] != null && p[k] !== "" ? "prefilled" as const : null);
  const f = (k: string, label: string, extra: Partial<React.ComponentProps<typeof Field>> = {}) => (
    <Field label={label} value={val(k)} onChange={(v) => setEdit(k, v)} tag={tag(k)} {...extra} />
  );

  const actual = Number(val("weight_kg")) || 0;
  const volumetric = (Number(val("cbm")) || 0) * VOL_FACTOR;
  const chargeable = Math.max(actual, volumetric);
  const lines: any[] = Array.isArray(p.lines) ? p.lines.filter((l: any) => l.l || l.w || l.h) : [];

  return (
    <>
      <Section id="sec-shipper" n={1} title="Shipper" sub="Who is sending the goods" state={states.shipper}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-6">
          {f("supplier_name", "Company", { className: "sm:col-span-4", required: true })}
          {f("supplier_contact", "Contact person", { className: "sm:col-span-2" })}
          {f("supplier_address", "Street address", { className: "sm:col-span-4", required: true })}
          {f("supplier_city", "City", { className: "sm:col-span-2" })}
          {f("supplier_phone", "Phone", { className: "sm:col-span-2", type: "tel" })}
          {f("supplier_email", "Email", { className: "sm:col-span-3", type: "email" })}
          {f("supplier_country", "Country", { className: "sm:col-span-1" })}
        </div>
      </Section>

      <Section id="sec-cargo" n={2} title="Cargo" state={states.cargo}
        sub={p.measured ? "Measured by our warehouse on arrival" : "As booked. Correct anything that has changed."}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
          {f("pieces", "Pieces", { type: "number", inputMode: "numeric", required: true })}
          {f("weight_kg", "Gross weight", { type: "number", inputMode: "decimal", suffix: "kg", required: true })}
          {f("cbm", "Volume", { type: "number", inputMode: "decimal", suffix: "m³" })}
          {f("po_number", "PO / order no.")}
          <div className="col-span-2 sm:col-span-4">
            <Label required tag={tag("goods_description")}>Description of goods</Label>
            <textarea value={val("goods_description") ?? ""} rows={2} onChange={(e) => setEdit("goods_description", e.target.value)}
              placeholder="e.g. 4 cartons of stainless kitchen equipment"
              className={`${inputCls()} h-auto resize-y py-2 leading-snug`} />
          </div>
        </div>

        {lines.length ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-[#EAECF0]">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[#F9FAFB] text-left text-[12px] text-[#667085]">
                <tr><th className="px-3 py-2 font-medium">Pieces</th><th className="px-3 py-2 font-medium">Dimensions (L × W × H)</th><th className="px-3 py-2 text-right font-medium">Weight</th><th className="px-3 py-2 text-right font-medium">Volume</th></tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-[#F2F4F7]">
                    <td className="px-3 py-2">{l.pieces ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[12.5px]">{[l.l, l.w, l.h].map((x) => x ?? "?").join(" × ")} {l.unit}</td>
                    <td className="px-3 py-2 text-right">{l.weight != null ? `${l.weight} kg` : "—"}</td>
                    <td className="px-3 py-2 text-right">{l.cbm != null ? `${l.cbm} m³` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-md bg-[#F2F4F7] px-2.5 py-1.5 text-[#475467]">Actual <b className="text-[#101828]">{n1(actual)} kg</b></span>
          <span className="rounded-md bg-[#F2F4F7] px-2.5 py-1.5 text-[#475467]">Volumetric <b className="text-[#101828]">{n1(volumetric)} kg</b></span>
          <span className="rounded-md bg-[#EEF2FB] px-2.5 py-1.5 text-[#0A2472]">Chargeable <b>{n1(chargeable)} kg</b></span>
          <span className="text-[12px] text-[#667085]">1 m³ = 167 kg. Charged on the greater of actual or volumetric.</span>
        </div>
      </Section>
    </>
  );
}
