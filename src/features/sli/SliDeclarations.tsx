// src/features/sli/SliDeclarations.tsx
// Sections 3–5: payment & customs, dangerous goods, security. One question per row.
import React from "react";
import { TriangleAlert } from "lucide-react";
import { Field, QRow, Section, Segmented, YN, err, inputCls, isYes, type SecState } from "./SliUI";

const BATTERY_OPTS = [
  { v: "consumer", t: "Consumer (AA, AAA)" },
  { v: "lithium_ion", t: "Lithium ion" },
  { v: "lithium_metal", t: "Lithium metal" },
  { v: "lead_acid", t: "Lead acid" },
];
const PURPOSE_OPTS = [{ v: "sold", t: "Sold" }, { v: "repair_return", t: "Repair & return" }, { v: "other", t: "Other" }];
const TOP_COUNTRIES = ["NZ", "AU", "CN", "US", "GB", "DE", "JP", "IN", "FJ"];

type Props = {
  answers: Record<string, any>; setAnswer: (k: string, v: any) => void;
  countries: { code: string; name: string }[]; errors: string[]; suggested: (k: string) => boolean;
  states: { customs: SecState; dg: SecState; security: SecState };
};

export default function SliDeclarations({ answers: a, setAnswer, countries, errors, suggested, states }: Props) {
  const tag = (k: string) => (suggested(k) ? "suggested" as const : null);
  const batteries: string[] = Array.isArray(a.batteries) ? a.batteries : [];
  const toggleBattery = (v: string) => setAnswer("batteries", batteries.includes(v) ? batteries.filter((x) => x !== v) : [...batteries, v]);
  const hasLithium = batteries.some((b) => /lithium/i.test(b));
  const top = TOP_COUNTRIES.map((c) => countries.find((x) => x.code === c)).filter(Boolean) as { code: string; name: string }[];

  return (
    <>
      <Section id="sec-customs" n={3} title="Payment & customs" sub="Needed for the export entry" state={states.customs}>
        <div className="divide-y divide-[#F2F4F7]">
          <QRow q="Are you paying the freight for this shipment?" required tag={tag("is_paying")} error={err(errors, "is_paying")}>
            <Segmented value={a.is_paying} options={YN} onChange={(v) => setAnswer("is_paying", v)} error={err(errors, "is_paying")} />
          </QRow>
          <QRow q="Do you need cargo insurance?" hint="We insure for the amount you enter." required tag={tag("insurance_required")}
            error={err(errors, "insurance_required") || err(errors, "insurance_amount")}
            below={isYes(a.insurance_required) ? (
              <Field label="Amount to insure" value={a.insurance_amount} type="number" inputMode="decimal" required className="max-w-[260px]"
                suffix={a.declared_currency || "NZD"} error={err(errors, "insurance_amount")} onChange={(v) => setAnswer("insurance_amount", v)} />
            ) : null}>
            <Segmented value={a.insurance_required} options={YN} error={err(errors, "insurance_required")} onChange={(v) => {
              setAnswer("insurance_required", v);
              if (v === "yes" && !a.insurance_amount && Number(a.declared_value) > 0) setAnswer("insurance_amount", a.declared_value);
            }} />
          </QRow>
          <QRow q="Is a duty drawback required?" required tag={tag("drawback_required")} error={err(errors, "drawback_required")}>
            <Segmented value={a.drawback_required} options={YN} onChange={(v) => setAnswer("drawback_required", v)} error={err(errors, "drawback_required")} />
          </QRow>
          <QRow q="Purpose of export" required tag={tag("purpose_of_export")} error={err(errors, "purpose_of_export") || err(errors, "purpose_other")}
            below={a.purpose_of_export === "other" ? (
              <input value={a.purpose_other ?? ""} placeholder="Tell us the purpose" onChange={(e) => setAnswer("purpose_other", e.target.value)}
                className={`${inputCls(err(errors, "purpose_other"))} max-w-[420px]`} />
            ) : null}>
            <Segmented value={a.purpose_of_export} options={PURPOSE_OPTS} onChange={(v) => setAnswer("purpose_of_export", v)} error={err(errors, "purpose_of_export")} />
          </QRow>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3.5 border-t border-[#F2F4F7] pt-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label className="mb-1.5 flex items-center text-[13px] font-medium text-[#344054]">
              Country of origin<span className="ml-0.5 text-[#F7941D]">*</span>
              {tag("country_of_origin") ? <span className="ml-1.5 rounded bg-[#FFF4E5] px-1.5 py-[1px] text-[10.5px] font-medium text-[#B54708]">Suggested</span> : null}
            </label>
            <select value={a.country_of_origin ?? ""} onChange={(e) => setAnswer("country_of_origin", e.target.value)} className={inputCls(err(errors, "country_of_origin"))}>
              <option value="">Where were the goods made?</option>
              {top.length ? <optgroup label="Common">{top.map((c) => <option key={`t-${c.code}`} value={c.code}>{c.name}</option>)}</optgroup> : null}
              <optgroup label="All countries">{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>
            </select>
          </div>
          <Field className="sm:col-span-2" label="Declared value" value={a.declared_value} type="number" inputMode="decimal" tag={tag("declared_value")}
            onChange={(v) => setAnswer("declared_value", v)} placeholder="Invoice total" />
          <Field className="sm:col-span-1" label="Currency" value={a.declared_currency} placeholder="NZD" tag={null}
            onChange={(v) => setAnswer("declared_currency", v.toUpperCase().slice(0, 3))} />
        </div>
      </Section>

      <Section id="sec-dg" n={4} title="Dangerous goods" sub="Airlines must know before loading" state={states.dg}>
        <div className="divide-y divide-[#F2F4F7]">
          <QRow q="Does this shipment contain dangerous goods?" hint="Flammables, aerosols, chemicals, magnets, dry ice and similar." required
            tag={tag("dangerous_goods")} error={err(errors, "dangerous_goods")}>
            <Segmented value={a.dangerous_goods} options={YN} onChange={(v) => setAnswer("dangerous_goods", v)} error={err(errors, "dangerous_goods")} />
          </QRow>
          <div className="py-3.5">
            <div className="text-[14px] font-medium text-[#101828]">Batteries in the shipment <span className="font-normal text-[#667085]">(tick any that apply)</span></div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BATTERY_OPTS.map((b) => {
                const on = batteries.includes(b.v);
                return (
                  <label key={b.v} className={`flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-[13.5px] transition ${
                    on ? "border-[#0A2472] bg-[#EEF2FB] text-[#0A2472]" : "border-[#D5D9E0] text-[#344054] hover:border-[#B4BBC6]"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleBattery(b.v)} className="h-4 w-4 accent-[#0A2472]" />{b.t}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        {isYes(a.dangerous_goods) || hasLithium ? (
          <div className="mt-1 flex items-start gap-2.5 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-3.5 py-2.5 text-[13px] text-[#93370D]">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>Attach a Dangerous Goods Declaration (or lithium battery declaration) in <a href="#sec-docs" className="font-semibold text-[#93370D]">Documents</a>. We can't submit the SLI without it.</span>
          </div>
        ) : null}
      </Section>

      <Section id="sec-security" n={5} title="Security & notes" state={states.security}>
        <div className="divide-y divide-[#F2F4F7]">
          <QRow q="Do you authorise UB Freight to screen this cargo?" required error={err(errors, "caa_screening_auth")}
            hint="NZ CAA security clearance. This can include opening packages. Without consent, cargo may be delayed or rejected.">
            <Segmented value={a.caa_screening_auth} options={YN} onChange={(v) => setAnswer("caa_screening_auth", v)} error={err(errors, "caa_screening_auth")} />
          </QRow>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3.5 border-t border-[#F2F4F7] pt-4 sm:grid-cols-2">
          <Field label="Notify party" value={a.notify_party} tag={tag("notify_party")} onChange={(v) => setAnswer("notify_party", v)} placeholder="Who to notify on arrival" />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#344054]">Special instructions</label>
            <textarea value={a.special_instructions ?? ""} rows={1} placeholder="Handling, delivery or anything we got wrong above"
              onChange={(e) => setAnswer("special_instructions", e.target.value)} className={`${inputCls()} h-10 min-h-10 resize-y py-2 leading-snug`} />
          </div>
        </div>
      </Section>
    </>
  );
}
