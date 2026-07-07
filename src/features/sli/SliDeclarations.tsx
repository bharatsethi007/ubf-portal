// src/features/sli/SliDeclarations.tsx
// All required SLI answers + battery/DG linkage + country dropdown (auto-suggested).
import React from "react";
import { Field, YesNo, Section, Label, err } from "./SliUI";

const BATTERY_OPTS = [
  { v: "consumer", t: "Consumer (AA, AAA)" },
  { v: "lithium_ion", t: "Lithium Ion" },
  { v: "lithium_metal", t: "Lithium Metal" },
  { v: "lead_acid", t: "Lead Acid" },
];
const PURPOSE_OPTS = [
  { v: "sold", t: "Sold" },
  { v: "repair_return", t: "Repair & Return" },
  { v: "other", t: "Other" },
];

export default function SliDeclarations({
  answers, setAnswer, countries, errors, declaredValue,
}: {
  answers: Record<string, any>; setAnswer: (k: string, v: any) => void;
  countries: { code: string; name: string }[]; errors: string[]; declaredValue?: number;
}) {
  const a = answers;
  const isYes = (v: any) => v === true || v === "yes";
  const toggleBattery = (v: string) => {
    const cur: string[] = Array.isArray(a.batteries) ? a.batteries : [];
    setAnswer("batteries", cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  const hasLithium = (Array.isArray(a.batteries) ? a.batteries : []).some((b: string) => /lithium/i.test(b));

  return (
    <>
      <Section title="Payment & Insurance">
        <YesNo label="Are you paying for this shipment?" value={a.is_paying} required
          error={err(errors, "is_paying")} onChange={(v) => setAnswer("is_paying", v)} />
        <YesNo label="Is insurance required?" value={a.insurance_required} required
          error={err(errors, "insurance_required")} onChange={(v) => {
            setAnswer("insurance_required", v);
            if (isYes(v) && !a.insurance_amount && declaredValue) setAnswer("insurance_amount", declaredValue);
          }} />
        {isYes(a.insurance_required) && (
          <Field label="Amount to be covered" value={a.insurance_amount} type="number" required
            error={err(errors, "insurance_amount")} onChange={(v) => setAnswer("insurance_amount", v)} />
        )}
      </Section>

      <Section title="Customs">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Declared Value" value={a.declared_value} type="number"
            onChange={(v) => setAnswer("declared_value", v)} />
          <Field label="Currency" value={a.declared_currency} placeholder="NZD"
            onChange={(v) => setAnswer("declared_currency", v)} />
        </div>
        <div>
          <Label required>Country of Origin</Label>
          <select value={a.country_of_origin ?? ""} onChange={(e) => setAnswer("country_of_origin", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm bg-white ${
              err(errors, "country_of_origin") ? "border-red-400 ring-1 ring-red-300" : "border-slate-200"
            }`}>
            <option value="">Select…</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <YesNo label="Is drawback required?" value={a.drawback_required} required
          error={err(errors, "drawback_required")} onChange={(v) => setAnswer("drawback_required", v)} />
        <div>
          <Label required>Purpose of Export</Label>
          <div className="flex gap-2 flex-wrap">
            {PURPOSE_OPTS.map((p) => (
              <button key={p.v} type="button" onClick={() => setAnswer("purpose_of_export", p.v)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  a.purpose_of_export === p.v ? "bg-[#0A2472] text-white border-[#0A2472]" : "bg-white text-slate-600 border-slate-200"
                } ${err(errors, "purpose_of_export") ? "ring-1 ring-red-300" : ""}`}>{p.t}</button>
            ))}
          </div>
          {a.purpose_of_export === "other" && (
            <input value={a.purpose_other ?? ""} placeholder="Please specify"
              onChange={(e) => setAnswer("purpose_other", e.target.value)}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
                err(errors, "purpose_other") ? "border-red-400" : "border-slate-200"}`} />
          )}
        </div>
      </Section>

      <Section title="Dangerous Goods & Batteries">
        <YesNo label="Does this shipment contain dangerous goods?" value={a.dangerous_goods} required
          error={err(errors, "dangerous_goods")} onChange={(v) => setAnswer("dangerous_goods", v)} />
        <div>
          <Label>Does it contain any of these batteries?</Label>
          <div className="grid grid-cols-2 gap-2">
            {BATTERY_OPTS.map((b) => {
              const on = (Array.isArray(a.batteries) ? a.batteries : []).includes(b.v);
              return (
                <button key={b.v} type="button" onClick={() => toggleBattery(b.v)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium text-left ${
                    on ? "bg-[#0A2472] text-white border-[#0A2472]" : "bg-white text-slate-600 border-slate-200"
                  }`}>{b.t}</button>
              );
            })}
          </div>
          {(isYes(a.dangerous_goods) || hasLithium) && (
            <p className="mt-2 text-[12px] text-[#F7941D] font-medium">
              ⚠ A Dangerous Goods certificate must be attached below.
            </p>
          )}
        </div>
      </Section>

      <Section title="Security & Instructions">
        <YesNo
          label="Do you authorise UB Freight to physically screen the cargo (NZ CAA security clearing), including opening packages?"
          value={a.caa_screening_auth} required error={err(errors, "caa_screening_auth")}
          onChange={(v) => setAnswer("caa_screening_auth", v)} />
        <Field label="Notify Party" value={a.notify_party} onChange={(v) => setAnswer("notify_party", v)} />
        <div>
          <Label>Special Instructions</Label>
          <textarea value={a.special_instructions ?? ""} rows={3}
            onChange={(e) => setAnswer("special_instructions", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </Section>
    </>
  );
}
