// src/features/sli/SliDeclarations.tsx
// Sections 4–5: payment & customs, then safety & security (DG, batteries, screening). One question per row.
import React from "react";
import { Sparkles, TriangleAlert } from "lucide-react";
import { Field, QRow, Section, Segmented, YN, err, inputCls, isYes, type SecState, type TagKind } from "./SliUI";
import SliCombo from "./SliCombo";
import type { DgHint } from "./dgHints";

const BATTERY_OPTS = [
  { v: "consumer", t: "Consumer (AA, AAA)" },
  { v: "lithium_ion", t: "Lithium ion" },
  { v: "lithium_metal", t: "Lithium metal" },
  { v: "lead_acid", t: "Lead acid" },
];
const PURPOSE_OPTS = [{ v: "sold", t: "Sold" }, { v: "repair_return", t: "Repair & return" }, { v: "other", t: "Other" }];
const TOP_COUNTRIES = ["NZ", "AU", "CN", "US", "GB", "DE", "JP", "IN", "FJ"];
const HELP = {
  country: "Where the goods were made or manufactured, not where they ship from.",
  value: "Total value on your commercial invoice. Used for customs and insurance.",
  currency: "Currency of the declared value, e.g. NZD, AUD, USD.",
  insured: "The amount we insure the cargo for. Usually the invoice value plus freight.",
};

type Props = {
  answers: Record<string, any>; setAnswer: (k: string, v: any) => void;
  countries: { code: string; name: string }[]; errors: string[]; tag: (k: string) => TagKind | null;
  hints: DgHint[]; states: { customs: SecState; dg: SecState };
};

export default function SliDeclarations({ answers: a, setAnswer, countries, errors, tag, hints, states }: Props) {
  const batteries: string[] = Array.isArray(a.batteries) ? a.batteries : [];
  const toggleBattery = (v: string) => setAnswer("batteries", batteries.includes(v) ? batteries.filter((x) => x !== v) : [...batteries, v]);
  const hasLithium = batteries.some((b) => /lithium/i.test(b));
  const suggestBattery = hints.find((h) => h.battery && !batteries.includes(h.battery))?.battery;
  const dgYes = isYes(a.dangerous_goods);

  return (
    <>
      <Section id="sec-customs" n={4} title="Payment & customs" sub="Needed for the export entry" state={states.customs}>
        <div className="divide-y divide-[#F2F4F7]">
          <QRow q="Are you paying the freight for this shipment?" hint="Answer No if the buyer pays (e.g. EXW or FOB terms)." required tag={tag("is_paying")} error={err(errors, "is_paying")}>
            <Segmented value={a.is_paying} options={YN} onChange={(v) => setAnswer("is_paying", v)} error={err(errors, "is_paying")} />
          </QRow>
          <QRow q="Do you need cargo insurance?" hint="Covers loss or damage in transit. We insure for the amount you enter." required tag={tag("insurance_required")}
            error={err(errors, "insurance_required") || err(errors, "insurance_amount")}
            below={isYes(a.insurance_required) ? (
              <Field label="Amount to insure" value={a.insurance_amount} type="number" inputMode="decimal" required className="max-w-[260px]" help={HELP.insured}
                suffix={a.declared_currency || "NZD"} error={err(errors, "insurance_amount")} onChange={(v) => setAnswer("insurance_amount", v)} />
            ) : null}>
            <Segmented value={a.insurance_required} options={YN} error={err(errors, "insurance_required")} onChange={(v) => {
              setAnswer("insurance_required", v);
              if (v === "yes" && !a.insurance_amount && Number(a.declared_value) > 0) setAnswer("insurance_amount", a.declared_value);
            }} />
          </QRow>
          <QRow q="Purpose of export" hint="Sold to a buyer, sent away for repair and coming back, or something else." required tag={tag("purpose_of_export")}
            error={err(errors, "purpose_of_export") || err(errors, "purpose_other")}
            below={a.purpose_of_export === "other" ? (
              <input value={a.purpose_other ?? ""} placeholder="Tell us the purpose" onChange={(e) => setAnswer("purpose_other", e.target.value)}
                className={`${inputCls(err(errors, "purpose_other"))} max-w-[420px]`} />
            ) : null}>
            <Segmented value={a.purpose_of_export} options={PURPOSE_OPTS} onChange={(v) => setAnswer("purpose_of_export", v)} error={err(errors, "purpose_of_export")} />
          </QRow>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3.5 border-t border-[#F2F4F7] pt-4 sm:grid-cols-6">
          <SliCombo id="f-country" label="Country of origin" className="sm:col-span-3" required value={a.country_of_origin}
            options={countries} top={TOP_COUNTRIES} onChange={(v) => setAnswer("country_of_origin", v)} placeholder="Where were the goods made?"
            error={err(errors, "country_of_origin")} tag={tag("country_of_origin")} help={HELP.country} />
          <Field className="sm:col-span-2" label="Declared value" value={a.declared_value} type="number" inputMode="decimal" tag={tag("declared_value")}
            help={HELP.value} onChange={(v) => setAnswer("declared_value", v)} placeholder="Invoice total" />
          <Field className="sm:col-span-1" label="Currency" value={a.declared_currency} placeholder="NZD" tag={tag("declared_currency")} help={HELP.currency}
            onChange={(v) => setAnswer("declared_currency", v.toUpperCase().slice(0, 3))} />
        </div>
      </Section>

      <Section id="sec-dg" n={5} title="Safety & security" sub="Airlines must know before loading" state={states.dg}>
        {hints.length && !dgYes ? (
          <div className="mb-2 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-[13px] text-[#93370D]">
            <div className="flex items-start gap-2.5">
              <Sparkles size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">This may be dangerous goods</div>
                <div className="mt-0.5">
                  Your description mentions {hints.map((h, i) => <React.Fragment key={h.kind}>{i ? ", " : ""}<b>"{h.word}"</b> ({h.kind.toLowerCase()})</React.Fragment>)}.
                  These are often restricted by air. If you're not sure, ask us before answering.
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setAnswer("dangerous_goods", "yes")} className="h-8 rounded-md bg-[#B54708] px-3 text-[12.5px] font-semibold text-white hover:bg-[#93370D]">Yes, it's DG</button>
                  {suggestBattery ? (
                    <button type="button" onClick={() => toggleBattery(suggestBattery)} className="h-8 rounded-md border border-[#FEC84B] bg-white px-3 text-[12.5px] font-medium text-[#93370D] hover:bg-[#FFF4E5]">
                      Tick {BATTERY_OPTS.find((b) => b.v === suggestBattery)?.t.toLowerCase()}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="divide-y divide-[#F2F4F7]">
          <QRow q="Does this shipment contain dangerous goods?" hint="Flammables, aerosols, chemicals, magnets, dry ice and similar." required
            tag={tag("dangerous_goods")} error={err(errors, "dangerous_goods")}>
            <Segmented value={a.dangerous_goods} options={YN} onChange={(v) => setAnswer("dangerous_goods", v)} error={err(errors, "dangerous_goods")} />
          </QRow>
          <div className="py-3.5">
            <div className="text-[14px] font-medium text-[#101828]">Batteries in the shipment <span className="font-normal text-[#667085]">(tick any that apply, including batteries inside equipment)</span></div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BATTERY_OPTS.map((b) => {
                const on = batteries.includes(b.v);
                const hinted = suggestBattery === b.v;
                return (
                  <label key={b.v} className={`flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-[13.5px] transition ${
                    on ? "border-[#0A2472] bg-[#EEF2FB] text-[#0A2472]" : hinted ? "border-[#FEC84B] bg-[#FFFCF5] text-[#344054]" : "border-[#D5D9E0] text-[#344054] hover:border-[#B4BBC6]"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleBattery(b.v)} className="h-4 w-4 accent-[#0A2472]" />{b.t}
                  </label>
                );
              })}
            </div>
          </div>
          <QRow q="Do you authorise UB Freight to screen this cargo?" required error={err(errors, "caa_screening_auth")} tag={tag("caa_screening_auth")}
            hint="NZ CAA security clearance. This can include opening packages. Without consent, cargo may be delayed or rejected.">
            <Segmented value={a.caa_screening_auth} options={YN} onChange={(v) => setAnswer("caa_screening_auth", v)} error={err(errors, "caa_screening_auth")} />
          </QRow>
        </div>
        {dgYes || hasLithium ? (
          <div className="mt-1 flex items-start gap-2.5 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-3.5 py-2.5 text-[13px] text-[#93370D]">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>Attach a Dangerous Goods Declaration (or lithium battery declaration) in <a href="#sec-docs" className="font-semibold text-[#93370D]">Documents</a>. We can't submit the SLI without it.</span>
          </div>
        ) : null}
      </Section>
    </>
  );
}
