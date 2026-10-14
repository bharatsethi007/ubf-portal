// src/features/sli/SliCargo.tsx
// Sections 1–2: shipper and cargo. Editable, prefilled from the booking or template, live chargeable weight.
import React from "react";
import { TriangleAlert } from "lucide-react";
import { Field, Label, Section, inputCls, type SecState, type TagKind } from "./SliUI";
import { HelpBubble, useTip } from "./SliHelp";
import SliPlace from "./SliPlace";
import { dgHints } from "./dgHints";

const VOL_FACTOR = 167; // 1 m³ = 167 kg (air)
const n1 = (v: number) => (v ? v.toLocaleString("en-NZ", { maximumFractionDigits: 1 }) : "0");

const HELP: Record<string, string> = {
  supplier_name: "The company sending the goods. This prints as the shipper on the air waybill.",
  supplier_contact: "Who we call if there's a question about the cargo.",
  supplier_address: "Where the goods are sent from. Start typing and pick from the list.",
  supplier_city: "Town or city of the shipper address.",
  supplier_phone: "Best number for the contact person.",
  supplier_email: "We send updates and your SLI copy here.",
  supplier_country: "Two-letter country code, e.g. NZ.",
  pieces: "Number of separate packages: cartons, pallets, crates. Not the number of items inside.",
  weight_kg: "Total weight including packaging, in kilograms.",
  cbm: "Total volume in cubic metres. L × W × H in metres, times the number of pieces.",
  po_number: "Your order or invoice number, so the buyer can match the shipment.",
  goods_description: "Plain description of what's inside, e.g. 'stainless steel kitchen equipment'. Customs and the airline read this.",
  special_instructions: "Anything we should know: fragile, keep upright, temperature, delivery notes, or anything above that's wrong.",
};

type Props = {
  prefilled: any; edits: Record<string, any>; setEdit: (k: string, v: any) => void;
  answers: Record<string, any>; setAnswer: (k: string, v: any) => void;
  fromTemplate: string[]; states: { shipper: SecState; cargo: SecState };
};

export default function SliCargo({ prefilled, edits, setEdit, answers, setAnswer, fromTemplate, states }: Props) {
  const p = prefilled ?? {};
  const val = (k: string) => (k in edits ? edits[k] : p[k]);
  const tag = (k: string): TagKind | null =>
    k in edits || p[k] == null || p[k] === "" ? null : fromTemplate.includes(k) ? "template" : "prefilled";
  const f = (k: string, label: string, extra: Partial<React.ComponentProps<typeof Field>> = {}) => (
    <Field label={label} value={val(k)} onChange={(v) => setEdit(k, v)} tag={tag(k)} help={HELP[k]} {...extra} />
  );
  const descTip = useTip("f-goods", HELP.goods_description);
  const noteTip = useTip("f-special", HELP.special_instructions);

  const actual = Number(val("weight_kg")) || 0;
  const volumetric = (Number(val("cbm")) || 0) * VOL_FACTOR;
  const chargeable = Math.max(actual, volumetric);
  const lines: any[] = Array.isArray(p.lines) ? p.lines.filter((l: any) => l.l || l.w || l.h) : [];
  const hints = dgHints(val("goods_description"));

  return (
    <>
      <Section id="sec-shipper" n={1} title="Shipper" sub="Who is sending the goods" state={states.shipper}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-6">
          {f("supplier_name", "Company", { className: "sm:col-span-4", required: true })}
          {f("supplier_contact", "Contact person", { className: "sm:col-span-2" })}
          <SliPlace id="f-supplier-address" label="Street address" className="sm:col-span-4" required
            value={val("supplier_address") ?? ""} tag={tag("supplier_address")} help={HELP.supplier_address}
            onText={(v) => setEdit("supplier_address", v)}
            onPick={(pl) => {
              setEdit("supplier_address", pl.street ? [pl.street, pl.suburb].filter(Boolean).join(", ") : pl.address);
              if (pl.city) setEdit("supplier_city", pl.city);
              if (pl.postcode) setEdit("supplier_postcode", pl.postcode);
              if (pl.country_code) setEdit("supplier_country", pl.country_code);
              if (pl.name && !val("supplier_name")) setEdit("supplier_name", pl.name);
            }} />
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
            <Label htmlFor="f-goods" required tag={tag("goods_description")} help={{ id: "f-goods", label: "Description of goods" }}>Description of goods</Label>
            <div className="relative">
              <HelpBubble id="f-goods" text={HELP.goods_description} />
              <textarea id="f-goods" value={val("goods_description") ?? ""} rows={2} onChange={(e) => setEdit("goods_description", e.target.value)} {...descTip}
                placeholder="e.g. 4 cartons of stainless kitchen equipment" className={`${inputCls()} h-auto resize-y py-2 leading-snug`} />
            </div>
            {hints.length ? (
              <a href="#sec-dg" className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#B54708] no-underline hover:underline">
                <TriangleAlert size={13} /> May be dangerous goods: {hints.map((h) => h.kind.toLowerCase()).join(", ")}. Please check in section 5.
              </a>
            ) : null}
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Label htmlFor="f-special" help={{ id: "f-special", label: "Special instructions" }}>Special instructions</Label>
            <div className="relative">
              <HelpBubble id="f-special" text={HELP.special_instructions} />
              <textarea id="f-special" value={answers.special_instructions ?? ""} rows={1} {...noteTip}
                placeholder="Fragile, keep upright, temperature, or anything we got wrong above"
                onChange={(e) => setAnswer("special_instructions", e.target.value)} className={`${inputCls()} h-10 min-h-10 resize-y py-2 leading-snug`} />
            </div>
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
