// src/features/sli/SliUpload.tsx
// Document attachments — upload to sli-uploads, tagged by doc_type.
import React, { useState, useRef } from "react";
import { Section, Label } from "./SliUI";

const DOC_TYPES = [
  { v: "commercial_invoice", t: "Commercial Invoice" },
  { v: "packing_list", t: "Packing List" },
  { v: "dg_cert", t: "Dangerous Goods Cert" },
  { v: "cert_origin", t: "Certificate of Origin" },
  { v: "export_permit", t: "Export Permit" },
  { v: "letter_of_credit", t: "Letter of Credit" },
  { v: "other", t: "Other" },
];

export default function SliUpload({
  attachments, uploadFile, removeAttachment, dgRequired, errors,
}: {
  attachments: any[];
  uploadFile: (f: File, t: string) => Promise<any>;
  removeAttachment: (path: string) => void;
  dgRequired: boolean;
  errors: string[];
}) {
  const [docType, setDocType] = useState("commercial_invoice");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { await uploadFile(file, docType); } catch { alert("Upload failed, please retry."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const dgMissing = dgRequired && !attachments.some((a) => a.doc_type === "dg_cert") && errors.includes("dg_cert_attachment");

  return (
    <Section title="Documents">
      <Label>Attach supporting documents</Label>
      <div className="flex gap-2">
        <select value={docType} onChange={(e) => setDocType(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
          {DOC_TYPES.map((d) => <option key={d.v} value={d.v}>{d.t}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-[#0A2472] text-white text-sm font-semibold px-4 disabled:opacity-50">
          {busy ? "Uploading…" : "Add file"}
        </button>
        <input ref={inputRef} type="file" hidden onChange={onPick}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      </div>

      {dgMissing && (
        <p className="text-[12px] text-red-500 font-medium">A Dangerous Goods certificate is required before you can submit.</p>
      )}

      <ul className="space-y-1.5 mt-2">
        {attachments.map((a) => (
          <li key={a.storage_path} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="truncate">
              <b className="text-[11px] uppercase text-slate-400 mr-2">
                {DOC_TYPES.find((d) => d.v === a.doc_type)?.t ?? a.doc_type}
              </b>
              {a.file_name}
            </span>
            <button type="button" onClick={() => removeAttachment(a.storage_path)}
              className="text-slate-400 hover:text-red-500 text-xs ml-2">Remove</button>
          </li>
        ))}
        {attachments.length === 0 && <li className="text-[12px] text-slate-400">No documents attached yet.</li>}
      </ul>
    </Section>
  );
}
