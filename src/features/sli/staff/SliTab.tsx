// src/features/sli/staff/SliTab.tsx
// Staff SLI tab inside a booking. Per-supplier list + actions + endorsed view.
import React, { useState } from "react";
import { useSliStaff } from "./useSliStaff";
import SliEndorsedView from "./SliEndorsedView";

const STATUS_STYLE: Record<string, string> = {
  none: "bg-slate-100 text-slate-500",
  sent: "bg-blue-50 text-blue-600",
  viewed: "bg-amber-50 text-amber-600",
  endorsed: "bg-emerald-50 text-emerald-600",
};
const STATUS_LABEL: Record<string, string> = {
  none: "Not created", sent: "Sent", viewed: "Viewed", endorsed: "Endorsed",
};

export default function SliTab({ bookingId, isConsolidation }: { bookingId: string; isConsolidation: boolean }) {
  const { rows, loading, busyId, generate, acceptEdits, fetchEvents, signedUrl } =
    useSliStaff(bookingId, isConsolidation);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading SLI status…</div>;

  const base = import.meta.env.VITE_SLI_PUBLIC_BASE_URL ?? window.location.origin;
  const linkFor = (token: string) => `${base}/sli/${token}`;
  const copy = async (token: string, id: string) => {
    await navigator.clipboard.writeText(linkFor(token));
    setCopied(id); setTimeout(() => setCopied(null), 1500);
  };

  const endorsedCount = rows.filter((r) => r.sli?.status === "endorsed").length;

  return (
    <div className="space-y-3">
      {isConsolidation && (
        <div className="text-sm text-slate-500">
          Consolidation SLI status: <b className="text-[#0A2472]">{endorsedCount}/{rows.length} endorsed</b>
        </div>
      )}

      {rows.map((r) => {
        const id = r.booking_supplier_id ?? "single";
        const status = r.sli?.status ?? "none";
        const isBusy = busyId === id;
        return (
          <div key={id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{r.name}</div>
                <span className={`inline-block mt-1 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_STYLE[status] ?? STATUS_STYLE.none}`}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!r.sli ? (
                  <button onClick={() => generate(r.booking_supplier_id)} disabled={isBusy}
                    className="bg-[#0A2472] text-white text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50">
                    {isBusy ? "Generating…" : "Generate & send"}
                  </button>
                ) : (
                  <>
                    <button onClick={() => copy(r.sli.token, id)}
                      className="text-xs font-semibold text-[#0A2472] border border-slate-200 rounded-lg px-3 py-1.5">
                      {copied === id ? "Copied!" : "Copy link"}
                    </button>
                    <button onClick={() => generate(r.booking_supplier_id)} disabled={isBusy}
                      className="text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 disabled:opacity-50">
                      {isBusy ? "…" : "Regenerate"}
                    </button>
                    {r.sli.status === "endorsed" && (
                      <button onClick={() => setExpanded(expanded === id ? null : id)}
                        className="text-xs text-[#0A2472] underline">
                        {expanded === id ? "Hide" : "Review"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {expanded === id && r.sli?.status === "endorsed" && (
              <SliEndorsedView sli={r.sli} onAccept={acceptEdits}
                fetchEvents={fetchEvents} signedUrl={signedUrl} />
            )}
          </div>
        );
      })}

      {rows.length === 0 && <div className="text-sm text-slate-400">No suppliers on this booking yet.</div>}
    </div>
  );
}
