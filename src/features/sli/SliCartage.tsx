// src/features/sli/SliCartage.tsx
// Section 3: how the cargo gets to UB Freight. Drop-off or pickup, ready date, pickup address.
import React from "react";
import { MapPin, Truck, Warehouse } from "lucide-react";
import { Field, Label, Section, err, inputCls, type SecState, type TagKind } from "./SliUI";
import { HelpBubble, useTip } from "./SliHelp";
import SliPlace from "./SliPlace";

const HELP = {
  ready: "The first day the cargo is packed, labelled and ready to leave. For drop-off, the day you'll bring it in.",
  pickup: "Where our driver collects from. Start typing and pick from the list.",
  contact: "Who our driver asks for on site.",
  phone: "Number the driver can call on the day.",
};

type Props = {
  a: Record<string, any>; setAnswer: (k: string, v: any) => void; errors: string[]; state: SecState;
  tag: (k: string) => TagKind | null; shipperAddress: string; cutoff?: string | null;
};

function Choice({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`flex flex-1 items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
        on ? "border-[#0A2472] bg-[#F5F7FC] ring-1 ring-[#0A2472]" : "border-[#D5D9E0] bg-white hover:border-[#98A2B3]"}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#0A2472] text-white" : "bg-[#F2F4F7] text-[#475467]"}`}>{icon}</span>
      <span><span className="block text-[14px] font-semibold text-[#101828]">{title}</span><span className="block text-[12.5px] text-[#667085]">{sub}</span></span>
    </button>
  );
}

export default function SliCartage({ a, setAnswer, errors, state, tag, shipperAddress, cutoff }: Props) {
  const mode = a.collection_mode as "pickup" | "dropoff" | undefined;
  const same = a.pickup_same !== false;
  const today = new Date().toISOString().slice(0, 10);
  const readyTip = useTip("f-ready", HELP.ready);
  const cut = cutoff ? new Date(cutoff).toLocaleString("en-NZ", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <Section id="sec-cartage" n={3} title="Pickup or drop-off" sub="How the cargo gets to us" state={state}>
      <div role="radiogroup" className={`flex flex-col gap-2.5 sm:flex-row ${err(errors, "collection_mode") ? "rounded-lg ring-2 ring-[#FEE4E2]" : ""}`}>
        <Choice on={mode === "pickup"} onClick={() => setAnswer("collection_mode", "pickup")} icon={<Truck size={16} />}
          title="UB Freight picks it up" sub="We book a truck to collect from you" />
        <Choice on={mode === "dropoff"} onClick={() => setAnswer("collection_mode", "dropoff")} icon={<Warehouse size={16} />}
          title="I'll drop it off" sub="Deliver to our Airport Oaks warehouse" />
      </div>
      {tag("collection_mode") ? <div className="mt-1.5 text-[12px] text-[#667085]">{tag("collection_mode") === "template" ? "From your saved template." : "From your booking."} Change it if needed.</div> : null}

      {mode ? (
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label htmlFor="f-ready" required tag={tag("cargo_ready_date")} help={{ id: "f-ready", label: "Cargo ready date" }}>
              {mode === "dropoff" ? "Drop-off date" : "Cargo ready date"}
            </Label>
            <div className="relative">
              <HelpBubble id="f-ready" text={HELP.ready} />
              <input id="f-ready" type="date" min={today} value={a.cargo_ready_date ?? ""} {...readyTip}
                onChange={(e) => setAnswer("cargo_ready_date", e.target.value)} className={inputCls(err(errors, "cargo_ready_date"))} />
            </div>
          </div>

          {mode === "dropoff" ? (
            <div className="flex items-start gap-3 rounded-lg bg-[#F9FAFB] px-4 py-3 sm:col-span-4">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#0A2472]" />
              <div className="text-[13px] leading-snug text-[#475467]">
                <div className="font-semibold text-[#101828]">UB Freight warehouse</div>
                173 Montgomerie Road, Airport Oaks, Auckland 2022
                {cut ? <div className="mt-0.5">Needs to be with us by <b className="text-[#101828]">{cut}</b>.</div> : null}
              </div>
            </div>
          ) : (
            <div className="sm:col-span-4">
              <Label tag={tag("pickup_same")}>Pick up from</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                {[{ v: true, t: "Shipper address", s: shipperAddress || "Address in section 1" }, { v: false, t: "Another address", s: "Warehouse, factory or depot" }].map((o) => (
                  <label key={String(o.v)} className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                    same === o.v ? "border-[#0A2472] bg-[#F5F7FC]" : "border-[#D5D9E0] hover:border-[#98A2B3]"}`}>
                    <input type="radio" name="pickup_same" checked={same === o.v} onChange={() => setAnswer("pickup_same", o.v)} className="mt-1 h-4 w-4 accent-[#0A2472]" />
                    <span className="min-w-0"><span className="block text-[13.5px] font-medium text-[#101828]">{o.t}</span><span className="block truncate text-[12px] text-[#667085]">{o.s}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === "pickup" && !same ? (
            <>
              <SliPlace id="f-pickup" label="Pickup address" className="sm:col-span-6" required error={err(errors, "pickup_address")}
                value={a.pickup_address ?? ""} tag={tag("pickup_address")} help={HELP.pickup} country="nz"
                onText={(v) => setAnswer("pickup_address", v)}
                onPick={(pl) => { setAnswer("pickup_address", pl.address); setAnswer("pickup_place", { lat: pl.lat, lng: pl.lng, city: pl.city, postcode: pl.postcode, place_id: pl.place_id, name: pl.name }); }} />
              <Field className="sm:col-span-3" label="Site contact" value={a.pickup_contact} tag={tag("pickup_contact")} help={HELP.contact} onChange={(v) => setAnswer("pickup_contact", v)} />
              <Field className="sm:col-span-3" label="Site phone" type="tel" value={a.pickup_phone} tag={tag("pickup_phone")} help={HELP.phone} onChange={(v) => setAnswer("pickup_phone", v)} />
            </>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
