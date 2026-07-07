// src/features/sli/SliCargo.tsx
// Shipment header (read-only, staff-set) + editable shipper/cargo with live volumetric weight.
import React from "react";
import { Field, Section, Label } from "./SliUI";

const VOL_FACTOR = 167; // 1 m³ = 167 kg (air), per SLI rule

export default function SliCargo({
  staff, prefilled, edits, setEdit, errors,
}: {
  staff: any; prefilled: any; edits: Record<string, any>; setEdit: (k: string, v: any) => void; errors: string[];
}) {
  const val = (k: string) => (k in edits ? edits[k] : prefilled?.[k]);

  const actual = Number(val("weight_kg")) || 0;
  const cbm = Number(val("cbm")) || 0;
  const volumetric = cbm * VOL_FACTOR;
  const chargeable = Math.max(actual, volumetric);

  return (
    <>
      <Section title="Shipment">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin" value={staff?.origin} readOnly />
          <Field label="Destination" value={staff?.destination} readOnly />
          <Field label="Incoterm" value={staff?.incoterm} readOnly />
          <Field label="Airline" value={staff?.airline_name} readOnly />
          <Field label="Flight #" value={staff?.flight_no} readOnly />
          <Field label="Booking Ref" value={staff?.booking_ref} readOnly />
        </div>
        <p className="text-[11px] text-slate-400">
          These details are set by UB Freight. If anything looks wrong, note it in special instructions below.
        </p>
      </Section>

      <Section title="Shipper / Sender">
        <Field label="Company" value={val("supplier_name")} onChange={(v) => setEdit("supplier_name", v)} />
        <Field label="Address" value={val("supplier_address")} onChange={(v) => setEdit("supplier_address", v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={val("supplier_city")} onChange={(v) => setEdit("supplier_city", v)} />
          <Field label="Phone" value={val("supplier_phone")} onChange={(v) => setEdit("supplier_phone", v)} />
        </div>
        <Field label="Email" value={val("supplier_email")} onChange={(v) => setEdit("supplier_email", v)} type="email" />
      </Section>

      <Section title="Cargo">
        <div className="grid grid-cols-2 gap-3">
          <Field label="No. of Pieces" value={val("pieces")} onChange={(v) => setEdit("pieces", v)} type="number" />
          <Field label="PO Number" value={val("po_number")} onChange={(v) => setEdit("po_number", v)} />
          <Field label="Gross Weight (kg)" value={val("weight_kg")} onChange={(v) => setEdit("weight_kg", v)} type="number" />
          <Field label="Volume (m³ / CBM)" value={val("cbm")} onChange={(v) => setEdit("cbm", v)} type="number" />
        </div>
        <div>
          <Label>Goods Description</Label>
          <textarea
            value={val("goods_description") ?? ""} rows={2}
            onChange={(e) => setEdit("goods_description", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        {/* live volumetric calc */}
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600 flex justify-between">
          <span>Volumetric: <b>{volumetric ? volumetric.toFixed(1) : "0"} kg</b></span>
          <span>Chargeable: <b className="text-[#0A2472]">{chargeable ? chargeable.toFixed(1) : "0"} kg</b></span>
        </div>
        <p className="text-[11px] text-slate-400">1 m³ = 167 kg. Freight charged on actual or volumetric, whichever is greater.</p>
      </Section>
    </>
  );
}
