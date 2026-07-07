// src/features/sli/staff/SliEndorsedView.tsx
// Expanded view for an endorsed SLI: edit-diff vs booking, answers, attachments, accept gate, audit.
import React, { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  is_paying: "Paying for shipment", insurance_required: "Insurance required",
  insurance_amount: "Insurance amount", dangerous_goods: "Dangerous goods",
  batteries: "Batteries", country_of_origin: "Country of origin",
  drawback_required: "Drawback required", purpose_of_export: "Purpose of export",
  caa_screening_auth: "CAA screening authorised", notify_party: "Notify party",
  special_instructions: "Special instructions",
};

export default function SliEndorsedView({
  sli, onAccept, fetchEvents, signedUrl,
}: {
  sli: any;
  onAccept: (sliId: string, fields?: string[]) => Promise<any>;
  fetchEvents: (sliId: string) => Promise<any[]>;
  signedUrl: (path: string) => Promise<string | null>;
}) {
  const [events, setEvents] = useState<any[]>([]);
  const [accepting, setAccepting] = useState(false);
  const edits = sli.customer_edits ?? {};
  const answers = sli.sli_answers ?? {};
  const prefilled = sli.prefilled ?? {};
  const editKeys = Object.keys(edits);

  useEffect(() => { fetchEvents(sli.id).then(setEvents); }, [sli.id]);

  const openFile = async (path: string) => {
    const u = await signedUrl(path);
    if (u) window.open(u, "_blank");
  };

  const accept = async () => {
    setAccepting(true);
    try { await onAccept(sli.id); } finally { setAccepting(false); }
  };

  const fmt = (v: any) => Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : v === false ? "No" : String(v ?? "—");

  return (
    <div className="border-t border-slate-100 mt-3 pt-3 space-y-4 text-sm">
      {/* proposed edits */}
      {editKeys.length > 0 ? (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Customer changed</div>
          <div className="space-y-1">
            {editKeys.map((k) => (
              <div key={k} className="flex justify-between gap-3 rounded bg-amber-50 px-2 py-1">
                <span className="text-slate-500">{k.replace(/_/g, " ")}</span>
                <span className="text-slate-400 line-through">{fmt(prefilled[k])}</span>
                <span className="font-semibold text-slate-800">{fmt(edits[k])}</span>
              </div>
            ))}
          </div>
          {!sli.edits_accepted_at ? (
            <button onClick={accept} disabled={accepting}
              className="mt-2 bg-[#0A2472] text-white text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50">
              {accepting ? "Applying…" : "Accept changes into booking"}
            </button>
          ) : (
            <p className="mt-2 text-[12px] text-emerald-600">✓ Changes accepted into booking</p>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-slate-400">No changes proposed by customer.</p>
      )}

      {/* answers */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Declarations</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(LABELS).map(([k, label]) => (
            <div key={k} className="flex justify-between">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-700 font-medium">{fmt(answers[k])}</span>
            </div>
          ))}
        </div>
      </div>

      {/* signature */}
      <div className="text-[12px] text-slate-500">
        Signed by <b className="text-slate-700">{sli.signed_name}</b>
        {sli.signed_at && <> on {new Date(sli.signed_at).toLocaleString("en-NZ")}</>}
      </div>

      {/* attachments */}
      {Array.isArray(sli.attachments) && sli.attachments.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Attachments</div>
          <ul className="space-y-1">
            {sli.attachments.map((a: any) => (
              <li key={a.storage_path}>
                <button onClick={() => openFile(a.storage_path)} className="text-[#0A2472] underline text-xs">
                  {a.doc_type}: {a.file_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* audit trail */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Audit trail</div>
        <ol className="space-y-0.5">
          {events.map((e, i) => (
            <li key={i} className="flex justify-between text-[12px] text-slate-500">
              <span className="capitalize">{e.event.replace(/_/g, " ")}</span>
              <span>{new Date(e.created_at).toLocaleString("en-NZ")}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
