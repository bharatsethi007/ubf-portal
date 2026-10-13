// src/features/sli/SliSummary.tsx
// Read-only shipment strip set by UB Freight: route, flight, consignee, terms.
import React from "react";
import { Plane } from "lucide-react";

const fmtDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
};
const fmtTime = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString("en-NZ", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

function Cell({ k, v, sub, mono }: { k: string; v?: React.ReactNode; sub?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-[11.5px] font-medium text-[#667085]">{k}</div>
      <div className={`truncate text-[14.5px] font-semibold text-[#101828] ${mono ? "font-mono tracking-tight" : ""}`}>{v || <span className="font-normal text-[#98A2B3]">To be advised</span>}</div>
      {sub ? <div className="truncate text-[12px] text-[#667085]">{sub}</div> : null}
    </div>
  );
}

export default function SliSummary({ staff, expiresAt }: { staff: any; expiresAt?: string | null }) {
  const s = staff ?? {};
  const via = s.transit_port ? `via ${s.transit_port}${s.flight2_no ? ` · ${s.flight2_no}` : ""}` : null;
  const consignee = [s.consignee_city, s.consignee_country].filter(Boolean).join(", ");
  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[#F2F4F7] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[22px] font-semibold tracking-tight text-[#0A2472]">{(s.origin || "AKL").toUpperCase()}</span>
          <span className="relative flex w-24 items-center">
            <span className="h-px flex-1 border-t border-dashed border-[#98A2B3]" />
            <Plane size={16} className="mx-1 text-[#F7941D]" />
            <span className="h-px flex-1 border-t border-dashed border-[#98A2B3]" />
          </span>
          <span className="font-mono text-[22px] font-semibold tracking-tight text-[#0A2472]">{(s.destination || "—").toUpperCase()}</span>
        </div>
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <div className="text-[13px] text-[#475467]">Booking <b className="font-mono text-[#101828]">{s.booking_ref}</b>{s.customer_ref ? <> · Your ref <b className="text-[#101828]">{s.customer_ref}</b></> : null}</div>
          <div className="text-[12.5px] text-[#667085]">Details below are from your booking. Check them, add your documents and sign.</div>
        </div>
        {expiresAt ? <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[12px] text-[#475467]">Link valid until {fmtDate(expiresAt)}</span> : null}
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-[#F2F4F7] sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <Cell k="Flight" v={s.flight_no} sub={[fmtDate(s.flight_date), via].filter(Boolean).join(" · ") || s.airline_name} mono />
        <Cell k="Cargo cut-off" v={fmtTime(s.cutoff_at)} sub="At UB Freight, Airport Oaks" />
        <Cell k="Consignee" v={s.consignee_name} sub={consignee || null} />
        <Cell k="Incoterm" v={s.incoterm} sub={s.cargo_ready_date ? `Ready ${fmtDate(s.cargo_ready_date)}` : null} />
        <Cell k="Service" v="Export air freight" sub={s.is_dg ? `DG${s.un_number ? ` · UN${s.un_number}` : ""}${s.dg_class ? ` · Class ${s.dg_class}` : ""}` : "General cargo"} />
      </div>
    </div>
  );
}
